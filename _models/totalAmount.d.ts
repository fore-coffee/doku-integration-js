declare class TotalAmount {
  value: string;
  currency: string;
  constructor(value?: string, currency?: string);
  toObject(): { value: string; currency: string };
}

export = TotalAmount;
