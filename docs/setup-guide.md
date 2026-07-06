# FMS 개발 설치 가이드 (단계별)

이 가이드는 **한 번에 모든 것을 설치하지 않고**, 개발 Phase에 맞춰 필요한 시점에 도구를 설치하는 방식이다. 각 섹션은 [development-checklist.md](./development-checklist.md)의 Phase와 대응한다.

- 환경: **Windows / PowerShell** 기준
- 패키지 매니저: **pnpm**
- 기술스택 상세: [requirements-tech-stack.md](./requirements-tech-stack.md)

> 원칙: "지금 필요한 것만 설치한다." 다음 Phase 도구는 해당 Phase에 진입할 때 설치한다.

---

## §1. 사전 준비 — 필수 기본 도구 (Phase 0)

가장 먼저 개발에 반드시 필요한 것만 설치한다.

### 1.1 Git
```powershell
winget install --id Git.Git -e
git --version
```

### 1.2 Node.js (LTS)
```powershell
winget install --id OpenJS.NodeJS.LTS -e
node -v
npm -v
```
> 여러 Node 버전을 관리하려면 `nvm-windows`(`winget install CoreyButler.NVMforWindows`)를 대신 사용해도 된다.

### 1.3 pnpm
```powershell
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```
> `corepack`이 권한 문제로 실패하면, Windows에서는 사용자 로컬 경로에 설치할 수 있다.
```powershell
npm install --global pnpm --prefix "$env:LOCALAPPDATA\pnpm"
& "$env:LOCALAPPDATA\pnpm\pnpm.cmd" -v
```
> 이 경우 현재 PowerShell 세션에서는 `pnpm` 대신 `"$env:LOCALAPPDATA\pnpm\pnpm.cmd"` 경로로 실행하거나, 이후 PATH에 사용자 로컬 경로를 추가한다.

### 1.4 Cursor 에디터 확장 (권장)
- ESLint / Prettier / Prisma / Tailwind CSS IntelliSense

**여기까지가 개발 시작 전 최소 준비다. 아래는 각 Phase 진입 시 설치한다.**

---

## §2. 저장소 초기화 (Phase 0)

```powershell
cd c:\CursorProject\fleet
git init
```
`.gitignore`에 아래가 포함되어야 한다. (Phase 1에서 프로젝트 생성 시 대부분 자동 추가됨)
```
node_modules/
.next/
.env*.local
.env
```

---

## §3. 프로젝트 기반 구축 (Phase 1)

> **실행 완료 (2026-07-06)** — 로컬 DB는 SQLite(`prisma/dev.db`). Supabase PostgreSQL은 Phase 4에서 전환.

### 3.1 Next.js + TypeScript + Tailwind 생성

루트에 `docs/`, `benchmarking/` 등이 있으면 빈 폴더가 아니므로, 임시 폴더에 생성 후 루트로 이동한다.

```powershell
$env:Path = "$env:LOCALAPPDATA\pnpm;$env:Path"
pnpm dlx create-next-app@latest web-temp --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --yes
# web-temp 내용을 프로젝트 루트로 이동 후 web-temp 삭제
```

실행 확인:
```powershell
pnpm dev
```

### 3.2 Prettier
```powershell
pnpm add -D prettier eslint-config-prettier
```

### 3.3 shadcn/ui
```powershell
pnpm dlx shadcn@latest init -y -d
pnpm dlx shadcn@latest add button card table badge -y
```

### 3.4 Prisma + 로컬 DB (SQLite)

Phase 1은 Supabase 없이 **SQLite**로 빠르게 시작한다. (Supabase는 Phase 4)

```powershell
pnpm add @prisma/client@6 dotenv
pnpm add -D prisma@6 tsx
pnpm approve-builds @prisma/client @prisma/engines prisma
```

`.env` (Prisma CLI용, git 제외):
```
DATABASE_URL="file:./dev.db"
VEHICLE_DATA_PROVIDER=mock
```

> `file:./dev.db` 경로는 `prisma/schema.prisma` 기준 상대경로 → 실제 파일은 `prisma/dev.db`

마이그레이션·시드:
```powershell
pnpm exec prisma migrate dev --name init
pnpm db:seed
```

### 3.5 환경 변수

`.env.example` (git 포함) — Supabase·Tesla·Kakao 키는 이후 Phase에서 채운다.

### 3.6 Supabase 클라이언트 (스텁)

```powershell
pnpm add @supabase/supabase-js
```

`src/lib/supabase/client.ts` — URL·키 미설정 시 `null` 반환 (Phase 4에서 연결).

### 3.7 Phase 1 검증

```powershell
pnpm lint
pnpm build
pnpm dev
# 다른 터미널에서
Invoke-RestMethod http://localhost:3000/api/vehicles
```

**Phase 1 완료 후 다음 Phase 전까지 추가 설치 불필요.**

---

## §4. 핵심 화면 (Phase 2)

### 4.1 TanStack Query
```powershell
pnpm add @tanstack/react-query
```

### 4.2 Kakao Maps
- 별도 npm 설치 없음. [Kakao Developers](https://developers.kakao.com)에서 앱 생성 → JavaScript 키 발급 → `NEXT_PUBLIC_KAKAO_MAP_KEY`에 설정
- 지도 SDK는 스크립트 로드 방식으로 사용 (동적 `<script>` 로딩)

### 4.3 차트 (대시보드 KPI, 선택)
```powershell
pnpm add recharts
```

---

## §5. 데이터 연동 (Phase 3)

이 단계에서는 **새 패키지보다 외부 서비스 설정**이 핵심이다.

### 5.1 테슬라 Fleet API
- Tesla 개발자 포털에서 애플리케이션 등록 → OAuth 클라이언트 발급
- 등록 절차·과금 조건 확인 (지연 대비 Mock 유지)
- `.env.local`에 인증 정보 추가:
```
TESLA_FLEET_API_CLIENT_ID=
TESLA_FLEET_API_CLIENT_SECRET=
TESLA_FLEET_API_REDIRECT_URI=
```

### 5.2 HTTP/스케줄 (필요 시)
- fetch는 기본 내장. 스케줄은 배포 후 Vercel Cron 사용 (§7)
- 로컬 주기 실행이 필요하면 API 라우트를 수동 호출하거나 간단한 스크립트로 대체

---

## §6. 안정화 · 테스트 (Phase 4)

### 6.1 Vitest (단위 테스트)
```powershell
pnpm add -D vitest @vitejs/plugin-react
```

### 6.2 Playwright (E2E)
```powershell
pnpm create playwright
```
> 브라우저 바이너리 설치를 함께 진행한다. 데모 시나리오 1~2종만 우선 작성.

### 6.3 로깅 (선택)
```powershell
pnpm add @sentry/nextjs
```

---

## §7. 배포 (Phase 5)

### 7.1 Vercel
- 권장: GitHub 저장소를 Vercel에 연결(자동 배포). 별도 CLI 설치 불필요
- CLI를 쓰려면:
```powershell
pnpm add -g vercel
vercel
```
- Vercel 대시보드에 `.env.local`의 값들을 Environment Variables로 등록 (Service Role 키는 서버 전용)

### 7.2 Vercel Cron
- `vercel.json`에 cron 설정 추가 → 주기적 데이터 동기화 API 호출

### 7.3 Supabase production
- production 프로젝트/스키마 분리, 접근 정책(RLS) 점검

---

## 설치 요약 (Phase별 신규 설치)

| Phase | 새로 설치하는 것 |
|-------|------------------|
| 0 | Git, Node.js, pnpm |
| 1 | Next.js, Prettier, shadcn/ui, Prisma, @supabase/supabase-js |
| 2 | @tanstack/react-query, (recharts) / Kakao 키 발급 |
| 3 | (설치 없음) Tesla Fleet API 등록·키 발급 |
| 4 | Vitest, Playwright, (Sentry) |
| 5 | (선택) Vercel CLI / Vercel·Supabase 설정 |

---

## 문제 해결 팁

- `pnpm` 인식 안 됨 → PowerShell 재시작 또는 `corepack enable`, 권한 이슈면 사용자 로컬 경로(`$env:LOCALAPPDATA\pnpm\pnpm.cmd`)로 실행
- `winget` 없음 → Microsoft Store에서 "앱 설치 관리자" 설치
- Prisma 연결 실패 → Supabase Connection String의 `?sslmode=require`·비밀번호 확인
- Kakao 지도 안 뜸 → 도메인(localhost) 등록 및 JS 키 확인

---

## 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-07-06 | 단계별 설치 가이드 초안 작성 (Windows/PowerShell 기준) |
| 2026-07-06 | Phase 0 실행 결과 반영 — Windows 권한 이슈 시 pnpm 사용자 로컬 설치 경로 추가 |
| 2026-07-06 | Phase 1 실행 결과 반영 — 임시 폴더 스캐폴딩, Prisma 6 + SQLite, 검증 명령 추가 |
