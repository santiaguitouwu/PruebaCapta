export type IsoUtcString = `${string}Z`;

export interface CalculateQuery {
    days?: number;
    hours?: number;
    date?: IsoUtcString;
}

export interface ApiSuccess {
    date: IsoUtcString;
}

export interface ApiError {
    error: 'InvalidParameters' | 'ServiceUnavailable' | 'InternalError';
    message: string;
}

export type HolidayDate = `${number}-${number}-${number}`; // YYYY-M-D o YYYY-MM-DD

export interface HolidaysSource {
    /** Conjunto de fechas festivas en formato YYYY-MM-DD */
    readonly dates: ReadonlySet<string>;
    /** Año mínimo y máximo presentes (para info/depuración) */
    readonly minYear: number | null;
    readonly maxYear: number | null;
}
