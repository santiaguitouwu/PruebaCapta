export class InvalidParametersError extends Error {
  public readonly code = 'InvalidParameters' as const;
  constructor(message: string) {
    super(message);
  }
}

export class ServiceUnavailableError extends Error {
  public readonly code = 'ServiceUnavailable' as const;
  constructor(message: string) {
    super(message);
  }
}

export class InternalAppError extends Error {
  public readonly code = 'InternalError' as const;
  constructor(message: string) {
    super(message);
  }
}
