export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "bad_request",
  ) {
    super(message);
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) return Response.json({ error: err.message, code: err.code }, { status: err.status });
  console.error(err);
  return Response.json({ error: "Erro interno" }, { status: 500 });
}
