"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWelcomeEmail = sendWelcomeEmail;
const googleapis_1 = require("googleapis");
const auth_1 = require("../auth");
function sendWelcomeEmail(employeeEmail, employeeName, eventUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const auth = yield (0, auth_1.getOAuthClient)();
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
        const subject = 'Welcome to OrgOS';
        const bodyText = `Welcome to OrgOS

Your onboarding has been scheduled.

Event
Employee Orientation

Open Calendar
${eventUrl}

GitHub invitation has been sent.

Regards
OrgOS`;
        const messageParts = [
            `To: ${employeeEmail}`,
            'Subject: ' + subject,
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            '',
            bodyText,
        ];
        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        const response = yield gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });
        return response.data;
    });
}
