const CreateVARequestDto = require('../../_models/createVaRequestDto');
const CheckStatusVARequestDto = require('../../_models/checkStatusVARequestDTO');
const DeleteVaRequestDto = require('../../_models/deleteVaRequestDTO');
const AdditionalInfo = require('../../_models/additionalInfo');
const VirtualAccountConfig = require('../../_models/virtualAccountConfig');
const TotalAmount = require('../../_models/totalAmount');
const { loadSandboxEnv, createSandboxSnap, callDoku, toWibIsoString } = require('./sandbox');

describe('DOKU sandbox: virtual account lifecycle', () => {
    const env = loadSandboxEnv();
    const snap = createSandboxSnap(env);

    const partnerServiceId = env.partnerServiceId.padStart(8, ' ');
    // a fresh VA per run, so one left behind by an aborted run never collides with the next
    const customerNo = `${env.customerNoPrefix}${Date.now().toString().slice(-9)}`;
    const virtualAccountNo = `${partnerServiceId}${customerNo}`;
    // the SDK short-circuits trxIds starting with 111x into canned simulator responses
    const trxId = `INT-${Date.now()}`;

    let created = false;
    let deleted = false;

    const deleteRequest = () => new DeleteVaRequestDto(partnerServiceId, customerNo, virtualAccountNo, trxId, env.vaChannel);

    afterAll(async () => {
        if (created && !deleted) {
            await snap.deletePaymentCode(deleteRequest()).catch(() => {});
        }
    });

    test('creates a closed-amount VA', async () => {
        const request = new CreateVARequestDto(
            partnerServiceId,
            customerNo,
            virtualAccountNo,
            'Integration Test',
            'integration@example.com',
            '6281234567890',
            trxId,
            new TotalAmount('10000.00', 'IDR'),
            new AdditionalInfo(env.vaChannel, new VirtualAccountConfig(false)),
            'C',
            toWibIsoString(new Date(Date.now() + 24 * 60 * 60 * 1000)),
            [{ english: 'Integration test', indonesia: 'Tes integrasi' }],
        );

        const response = await callDoku(() => snap.createVa(request));
        created = true;

        expect(response.responseCode).toBe('2002700');
        expect(response.virtualAccountData.trxId).toBe(trxId);
        expect(response.virtualAccountData.virtualAccountNo.trim()).toBe(virtualAccountNo.trim());
    });

    test('reports the status of the created VA', async () => {
        expect(created).toBe(true);
        const request = new CheckStatusVARequestDto(partnerServiceId, customerNo, virtualAccountNo, null, null, { channel: env.vaChannel });

        const response = await callDoku(() => snap.checkStatusVa(request));

        expect(response.responseCode).toBe('2002600');
    });

    test('deletes the created VA', async () => {
        expect(created).toBe(true);

        const response = await callDoku(() => snap.deletePaymentCode(deleteRequest()));
        deleted = true;

        expect(response.responseCode).toBe('2003100');
    });
});
