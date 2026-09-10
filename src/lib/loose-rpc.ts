export type LooseRpcResult<T = unknown> = PromiseLike<{
  data: T;
  error: { message: string } | null;
}>;

export function asLooseRpc<T>(
  rpcResult: LooseRpcResult<T>
): PromiseLike<{
  data: T;
  error: { message: string } | null;
}> {
  return rpcResult;
}
