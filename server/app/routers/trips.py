from openai import OpenAI
import os

# ✅ OpenAI Client 초기화 (환경변수에서 키 불러오기)
_client = OpenAI()
print("DEBUG Init OpenAI Client:", _client is not None)

from fastapi import APIRouter, Body
from pydantic import BaseModel
from typing import List, Optional
import json

from openai import OpenAI
import os, re, json
from fastapi import APIRouter, Body
from pydantic import BaseModel
from typing import List, Optional

# ✅ OpenAI Client: 환경변수(OPENAI_API_KEY)에서 자동 인식
_client = OpenAI()
print("DEBUG Init OpenAI Client:", _client is not None, "| API KEY EXISTS:", bool(os.getenv("OPENAI_API_KEY")))

router = APIRouter()

# ==========================
# 📌 데이터 모델
# ==========================
class StopItem(BaseModel):
    time: Optional[str] = None
    title: str
    place: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None
    mission: Optional[str] = None

class DayPlan(BaseModel):
    day: int
    theme: Optional[str] = None
    date: Optional[str] = None
    stops: List[StopItem] = []

class TravelPlan(BaseModel):
    summary: str
    days: List[DayPlan]

class PlanInput(BaseModel):
    bookTitle: str
    travelers: int
    days: int
    theme: str

# ==========================
# 📌 프롬프트 (불필요 키 금지 + JSON-only + 동선 최적화 + 미션 필수)
# ==========================
PROMPT_TMPL = """당신은 문학 여행 기획자이자 게이미피케이션 전문가입니다.
아래 책을 바탕으로, 실제 방문 가능한 장소와 책 속 장면을 연결한 효율적인 여행 코스를 설계하고,
각 코스마다 책 내용 기반 '미션(도장/리워드 지급 조건)'을 포함하세요.

입력:
- 책 제목: {bookTitle}
- 여행 인원: {travelers}명
- 여행 기간: {days}일
- 여행 테마: {theme}

요구사항(반드시 준수):
1) 결과는 **순수 JSON만** 출력 (설명/마크다운/코드블록 금지).
2) **필드 구조를 정확히 준수**:
{{
  "summary": "책과 여행을 연결한 요약",
  "days": [
    {{
      "day": 1,
      "theme": "테마",
      "stops": [
        {{
          "time": "09:00",
          "title": "코스 제목",
          "place": "실제 장소",
          "notes": "설명 (책 속 장면과 연결, 동선 고려)",
          "mission": "특별 미션 설명 (예: 주인공 OO가 울었던 나무 아래에서 사진 찍고 인증 → 도장/리워드 지급)"
        }}
      ]
    }}
  ]
}}
3) **불필요한 키 (예: book_summary, tips, itinerary, plan 등)** 절대 포함하지 말 것.
4) **동선 최적화**: 같은 지역은 인접 순서로 배치, 오전→점심→오후→저녁 흐름 유지, 불필요한 왕복/점프 금지.
5) **미션 필수**: 각 stop마다 최소 1개, 책의 특정 장면/행동/음식과 직접 연결. 인증 방식(사진/영상/SNS)과 보상(도장/리워드)을 포함.
"""

# ==========================
# 📌 Fallback Plan
# ==========================
def _fallback_plan(inp: PlanInput) -> TravelPlan:
    days: List[DayPlan] = []
    for d in range(1, inp.days + 1):
        days.append(DayPlan(
            day=d,
            theme=f"{inp.theme} 테마 Day {d}",
            stops=[
                StopItem(time="09:30", title=f"{inp.bookTitle} 배경지 산책", place="도심 명소",
                         notes="책 속 주요 배경과 연결된 장소", mission="해당 배경에서 인증샷 촬영 → 도장 지급"),
                StopItem(time="12:30", title="현지 식당 점심", place="지역 맛집",
                         notes="책 속 음식과 연계", mission="책 속에 등장한 음식 주문하고 사진 인증 → 리워드 지급"),
                StopItem(time="15:00", title="관련 전시/도서관 방문", place="문화 공간",
                         notes="작가/작품 관련 전시 관람", mission="좋아하는 구절 낭독 영상 업로드 → 도장 지급"),
                StopItem(time="19:00", title="야경 산책", place="강변/전망대",
                         notes="하루 마무리 산책", mission="야경 인증샷과 오늘의 한줄 소감 기록 → 리워드 지급")
            ]
        ))
    return TravelPlan(
        summary=f"'{inp.bookTitle}'를 바탕으로 한 {inp.days}일 {inp.theme} 여행입니다. 각 코스에는 인증 기반 미션이 포함됩니다.",
        days=days
    )

# ==========================
# 📌 유틸: 모델 응답 → dict 강제 변환 (튼튼한 파서)
# ==========================
def _coerce_to_json_dict(raw: str) -> dict:
    """모델 출력에서 순수 JSON 오브젝트만 안전하게 뽑아 dict로 변환."""
    s = raw.strip()

    # 1) ```json ... ``` 또는 ``` ... ``` 제거
    if s.startswith("```"):
        # 백틱 덩어리 제거
        s = s.strip("`").strip()
        # 'json' 프리픽스 제거
        if s.lower().startswith("json"):
            s = s[4:].strip()

    # 2) 가장 바깥 {} 블록만 추출 (여러 텍스트가 섞여도 JSON 본문만 뽑기)
    m = re.search(r"\{[\s\S]*\}", s)
    if not m:
        raise ValueError("No JSON object found in response.")
    s = m.group(0)

    # 3) 진짜 JSON 파싱 (trailing comma 등으로 실패 시 한 번 더 정리 시도 가능)
    try:
        return json.loads(s)
    except json.JSONDecodeError as e:
        # 흔한 케이스: trailing comma 등 — 가볍게 정리 시도
        # (필요하면 json5 사용 가능: pip install json5 후 import json5 as json)
        # 여기서는 기본만 다룹니다.
        # 작은 흔적 제거: BOM, 비표준 따옴표 교정 시도 등
        s2 = s.replace("\uFEFF", "").replace("\r", "")
        return json.loads(s2)

# ==========================
# 📌 API
# ==========================
@router.post("/{trip_id}/plan", response_model=TravelPlan)
def generate_plan(trip_id: str, payload: PlanInput = Body(...)):
    try:
        prompt = PROMPT_TMPL.format(**payload.model_dump())
        print("DEBUG Sending prompt to OpenAI...")

        # 1) JSON 강제 모드로 시도 (지원 모델 권장: gpt-4o-mini 등)
        try:
            resp = _client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a strict JSON generator. Output JSON only."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=2000,
            )
            content = resp.choices[0].message.content or ""
            print("DEBUG Raw (json_object) head:", content[:200])
        except Exception as e:
            # 2) json_object 미지원/실패 → 일반 호출로 폴백
            print("WARN response_format failed, fallback to normal completion:", e)
            resp = _client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a strict JSON generator. Output JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=2000,
            )
            content = resp.choices[0].message.content or ""
            print("DEBUG Raw (normal) head:", content[:200])

        # ✅ JSON만 추출/파싱 (튼튼한 파서)
        data = _coerce_to_json_dict(content)

        # ✅ 불필요한 필드 제거 & 필수 필드 보정
        allowed_top = {"summary", "days"}
        data = {k: v for k, v in data.items() if k in allowed_top}

        # days 누락 시 대체 입력 찾기
        if "days" not in data:
            for alt in ("itinerary", "plan", "days_plan"):
                if alt in data and isinstance(data[alt], list):
                    data["days"] = data[alt]
                    break
            if "days" not in data:
                data["days"] = []

        if "summary" not in data:
            # book_summary 등에 summary가 있으면 보정
            if "book_summary" in data and isinstance(data["book_summary"], dict):
                data["summary"] = data["book_summary"].get("summary") or f"{payload.bookTitle} 기반 여행 요약"
            else:
                data["summary"] = f"{payload.bookTitle} 기반 여행 요약"

        # ✅ Pydantic 검증 통과하도록 캐스팅
        return TravelPlan(**data)

    except Exception as e:
        print("DEBUG OpenAI Error:", e)
        print("DEBUG Fallback triggered.")
        return _fallback_plan(payload)