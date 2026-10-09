const notificationService = require("../_services/notificationService");

describe('notification response', () => {
    test('generateNotificationResponse echoes virtualAccountNo', () => {
        const dto = { partnerServiceId: '1', customerNo: '2', virtualAccountNo: '123', virtualAccountName: 'n', paymentRequestId: 'p' };
        expect(notificationService.generateNotificationResponse(dto).virtualAccountNo).toBe('123');
        expect(notificationService.generateInvalidTokenResponse(dto).virtualAccountNo).toBe('123');
    });
});
