import postgres from 'postgres';

/**
 * 서버리스는 함수 인스턴스마다 커넥션을 연다. Supabase 무료 풀러는 동시 접속이 빠듯해서
 * transaction 모드 풀러(6543)에 인스턴스당 1개만 붙는다.
 * pgbouncer는 prepared statement를 못 받으므로 prepare: false가 필수다.
 * 개발 중 핫 리로드로 커넥션이 쌓이지 않게 전역에 하나만 둔다.
 */
const sql = globalThis.__drippediaSql ?? postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
globalThis.__drippediaSql = sql;

export default sql;
