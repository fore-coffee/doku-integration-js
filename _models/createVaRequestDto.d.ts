declare class CreateVARequestDto {
  partnerServiceId: string;
  customerNo: string;
  virtualAccountNo: string;
  virtualAccountName: string;
  virtualAccountEmail: string;
  virtualAccountPhone: string;
  trxId: string;
  totalAmount: unknown;
  additionalInfo: unknown;
  virtualAccountTrxType: string;
  expiredDate: string;
  freeText?: unknown;
  constructor(...args: Array<unknown>);
}

export = CreateVARequestDto;
