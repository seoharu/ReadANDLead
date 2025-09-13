import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  FaBook,
  FaMapMarkedAlt,
  FaBookOpen,
  FaImages,
  FaSignInAlt,
} from 'react-icons/fa';
import type { IconType, IconBaseProps } from 'react-icons';
import { createPortal } from 'react-dom';

// ✅ 올바른 경로(components → api) : 한 단계만 올라가면 됩니다.
import { register, login, me } from '../api/auth';

const iconEl = (C: IconType) =>
  React.createElement(C as unknown as React.ComponentType<IconBaseProps>);

/* ===== styled components ===== */
const HeaderContainer = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 1000;
  padding: env(safe-area-inset-top, 0px) 20px 0 20px; /* status bar 안전영역 확보 */
  @media (max-width: 768px) {
    padding: env(safe-area-inset-top, 0px) 12px 0 12px;
  }
`;

const Nav = styled.nav`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 80px;
  @media (max-width: 768px) {
    height: 56px;
  }
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 32px;
  @media (max-width: 900px) {
    gap: 14px;
  }
`;

const Logo = styled(Link)`
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-size: 1.8rem;
  font-weight: 700;
  white-space: nowrap;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  &:hover {
    transform: scale(1.05);
    transition: transform 0.3s ease;
  }
  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const NavMenu = styled.ul`
  display: flex;
  gap: 32px;
  list-style: none;
  align-items: center;
  margin: 0;
  padding: 0;
  flex-wrap: nowrap;
  @media (max-width: 900px) { display: none; }
`;

const NavItem = styled.li`
  position: relative;
`;

const NavLink = styled(Link)<{ $active: boolean }>`
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
  white-space: nowrap;
  color: ${(p) => (p.$active ? '#667eea' : '#666')};
  background: ${(p) => (p.$active ? 'rgba(102,126,234,0.1)' : 'transparent')};
  &:hover {
    color: #667eea;
    background: rgba(102,126,234,0.1);
    transform: translateY(-2px);
  }
  @media (max-width: 900px) {
    padding: 8px 10px;
    font-size: 0.9rem;
  }
`;

const AuthArea = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: 40px;
  @media (max-width: 900px) {
    margin-left: 12px;
  }
`;

// Mobile menu (drawer)
const MobileMenuBtn = styled.button`
  display: none;
  @media (max-width: 900px) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e5e5;
    background: #fff;
    padding: 8px 10px;
    border-radius: 10px;
    cursor: pointer;
  }
`;

const DrawerBackdrop = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 1200;
  display: flex; justify-content: flex-end;
`;
const Drawer = styled.nav`
  width: min(86vw, 320px); height: 100%; background: #fff;
  padding: 14px; box-shadow: -8px 0 24px rgba(0,0,0,.15);
  display: flex; flex-direction: column; gap: 8px;
`;
const DrawerItem = styled(Link)<{ $active?: boolean }>`
  padding: 12px 14px; border-radius: 10px; text-decoration: none;
  color: ${(p) => (p.$active ? '#667eea' : '#333')};
  background: ${(p) => (p.$active ? 'rgba(102,126,234,0.1)' : '#fff')};
  border: 1px solid ${(p) => (p.$active ? 'rgba(102,126,234,.3)' : '#e5e5e5')};
`;

const LoginBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  white-space: nowrap;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid #e5e7ff;
  background: #f5f6ff;
  color: #444;
  font-weight: 700;
  &:hover {
    background: #eef0ff;
  }
`;

const LogoutBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 10px;
  white-space: nowrap;
  cursor: pointer;
  font-weight: 700;
  color: #fff;
  background: #667eea;
  border: none;
  &:hover {
    opacity: 0.9;
  }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
`;

const Modal = styled.div`
  width: 360px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
  padding: 20px;
`;

const ModalTitle = styled.h3`
  margin: 0 0 12px;
`;

const Providers = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ProviderBtn = styled.button`
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid #e5e5e5;
  background: #fff;
  &:hover {
    background: #f7f7ff;
  }
`;

const Form = styled.form`
  display: grid;
  gap: 10px;
`;

const Label = styled.label`
  display: grid;
  gap: 6px;
  font-weight: 600;
`;

const Input = styled.input`
  border: 1px solid #e5e5e5;
  border-radius: 10px;
  padding: 10px 12px;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
`;

const Button = styled.button<{ $primary?: boolean }>`
  border: 1px solid ${(p) => (p.$primary ? '#667eea' : '#e5e5e5')};
  background: ${(p) => (p.$primary ? '#667eea' : '#fff')};
  color: ${(p) => (p.$primary ? '#fff' : '#333')};
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorText = styled.div`
  color: #c00;
  font-size: 0.9rem;
`;

/* ===== small helpers ===== */
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  createPortal(children, document.body);

/* ===== component ===== */
type NavItemDef = { path: string; label: string; icon: () => React.ReactNode };
type Profile = { id: string; email: string; display_name?: string };

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('token')
  );
  const [profile, setProfile] = useState<Profile | null>(null);

  // form state
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // CRA / Vite 둘 다 대응 (경고는 무시 가능)
  const API_URL = useMemo(
    () =>
      (import.meta as any)?.env?.VITE_API_URL ||
      (process.env as any)?.REACT_APP_API_URL ||
      'http://127.0.0.1:8000',
    []
  );

  // 토큰 있으면 내 정보 불러오기
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!token) {
        setProfile(null);
        return;
      }
      try {
        const p = await me();
        if (!ignore) {
          setProfile({
            id: String(p.id),
            email: p.email,
            display_name: p.display_name,
          });
        }
      } catch {
        if (!ignore) setProfile(null);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [token]);

  const navItems: NavItemDef[] = [
    { path: '/', label: '홈', icon: () => iconEl(FaBook) },
    { path: '/map', label: '책으로 장소찾기', icon: () => iconEl(FaMapMarkedAlt) },
    { path: '/place-to-book', label: '장소로 책 찾기', icon: () => iconEl(FaMapMarkedAlt) },

    { path: '/travel-diary', label: '여행 퀘스트북', icon: () => iconEl(FaBookOpen) },

    { path: '/agency-trips', label: '관광사와 책여행 떠나기', icon: () => iconEl(FaBookOpen) },

    { path: '/four-cut', label: '인생네컷', icon: () => iconEl(FaImages) },
    { path: '/neighbors', label: '이웃의 책여행 따라가기', icon: () => iconEl(FaBook) },
  ];

  function doLogout() {
    localStorage.removeItem('token');
    setToken(null);
    setProfile(null);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrMsg('');

    try {
      if (mode === 'register') {
        const t = await register({
          email: email.trim(),
          password,
          display_name: (displayName || email.split('@')[0]).trim(),
        });
        localStorage.setItem('token', t.access_token);
        setToken(t.access_token);
      } else {
        const t = await login({
          email: email.trim(),
          password,
        });
        localStorage.setItem('token', t.access_token);
        setToken(t.access_token);
      }

      // 프로필 동기화
      const p = await me();
      setProfile({ id: String(p.id), email: p.email, display_name: p.display_name });

      // 초기화 & 닫기
      setEmail('');
      setPassword('');
      setDisplayName('');
      setShowModal(false);

      if (mode === 'register') navigate('/neighbors'); // 가입 직후 목록으로
    } catch (e: any) {
      setErrMsg(e?.message || '요청 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <HeaderContainer>
      <Nav>
        <Left>
          <Logo to="/">{iconEl(FaBook)} Read &amp; Lead</Logo>
          <MobileMenuBtn onClick={() => setMenuOpen(true)}>메뉴</MobileMenuBtn>
          <NavMenu>
            {navItems.map((item) => (
              <NavItem key={item.path}>
                <NavLink to={item.path} $active={location.pathname === item.path}>
                  {item.icon()}
                  {item.label}
                </NavLink>
              </NavItem>
            ))}
          </NavMenu>
                </Left>

        <AuthArea>
          {!profile ? (
            <LoginBtn
              onClick={() => {
                setMode('login');
                setShowModal(true);
              }}
            >
              {iconEl(FaSignInAlt)} 로그인
            </LoginBtn>
          ) : (
            <>
              <div style={{ fontWeight: 700, color: '#555', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.display_name || profile.email}
              </div>
              <LogoutBtn onClick={doLogout}>로그아웃</LogoutBtn>
            </>
          )}
        </AuthArea>
      </Nav>

      {menuOpen && (
        <DrawerBackdrop onClick={() => setMenuOpen(false)}>
          <Drawer onClick={(e)=>e.stopPropagation()}>
            {navItems.map((it) => (
              <DrawerItem key={it.path} to={it.path} $active={location.pathname === it.path} onClick={() => setMenuOpen(false)}>
                {it.label}
              </DrawerItem>
            ))}
          </Drawer>
        </DrawerBackdrop>
      )}

      {showModal && (
        <Portal>
          <Backdrop onClick={() => setShowModal(false)}>
            <Modal onClick={(e) => e.stopPropagation()}>
              <ModalTitle>{mode === 'login' ? '로그인' : '회원가입'}</ModalTitle>

              <Row style={{ justifyContent: 'flex-start' }}>
                <Button
                  type="button"
                  $primary={mode === 'login'}
                  onClick={() => setMode('login')}
                >
                  로그인
                </Button>
                <Button
                  type="button"
                  $primary={mode === 'register'}
                  onClick={() => setMode('register')}
                >
                  가입하기
                </Button>
              </Row>

              <Form onSubmit={handleAuth}>
                <Label>
                  이메일
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </Label>

                {mode === 'register' && (
                  <Label>
                    표시 이름(선택)
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="프로필에 보일 이름"
                    />
                  </Label>
                )}

                <Label>
                  비밀번호
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </Label>

                {errMsg && <ErrorText>{errMsg}</ErrorText>}

                <Row>
                  <Button type="button" onClick={() => setShowModal(false)}>
                    취소
                  </Button>
                  <Button type="submit" $primary disabled={submitting}>
                    {submitting ? '처리중…' : mode === 'login' ? '로그인' : '가입하기'}
                  </Button>
                </Row>
              </Form>
            </Modal>
          </Backdrop>
        </Portal>
      )}
    </HeaderContainer>
  );
}
