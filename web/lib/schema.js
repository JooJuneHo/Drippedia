import { z } from 'zod';

/**
 * 스프링 쪽 jakarta.validation 제약을 그대로 옮긴 것.
 * 입력 검증은 신뢰 경계라 줄이지 않는다 - 프론트가 막아도 API는 직접 열 수 있다.
 */
const required = max => z.string().trim().min(1).max(max);
const optional = max => z.string().max(max).nullish().transform(v => v?.trim() || null);
const intIn = (min, max) => z.number().int().min(min).max(max);

const Step = z.object({
  startTimeSeconds: intIn(0, 3600),
  pourAmount: intIn(1, 5000),
  note: optional(100)
});

export const RecipeForm = z.object({
  title: required(100),
  beanName: required(100),
  // 빈 문자열은 "안 넣음"으로 본다. 값이 있으면 http/https만.
  purchaseUrl: z.string().max(500).nullish()
    .transform(v => v?.trim() || null)
    .refine(v => v === null || /^https?:\/\/.+/.test(v), 'http로 시작하는 주소만 넣을 수 있습니다.'),
  origin: required(100),
  dripper: required(50),
  serveType: z.enum(['HOT', 'ICE']),
  coffeeAmount: intIn(1, 500),
  waterAmount: intIn(1, 5000),
  waterTemp: intIn(1, 100),
  grindSize: optional(50),
  grinder: optional(50),
  description: optional(2000),
  steps: z.array(Step).min(1)
});

export const CommentForm = z.object({
  content: required(500),
  parentId: z.number().int().nullish().transform(v => v ?? null)
});

export const NicknameForm = z.object({ nickname: required(30) });

/** 통과하면 값을, 아니면 400 Response를 던진다(스프링의 MethodArgumentNotValidException 자리). */
export async function parse(schema, request) {
  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    throw Response.json({ message: '입력값을 확인해주세요.', errors: result.error.issues }, { status: 400 });
  }
  return result.data;
}

/** 경로 변수는 숫자만 받는다. 아니면 404 (스프링은 여기서 400을 냈지만 프론트 동작은 같다). */
export function id(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw Response.json({ message: '찾을 수 없습니다.' }, { status: 404 });
  }
  return parsed;
}

/** 음수 페이지로 터지지 않게만 막는다. 크기는 서버가 정한다. */
export const page = value => Math.max(Number(value) || 0, 0);
