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
exports.createOrientationEvent = createOrientationEvent;
const googleapis_1 = require("googleapis");
const auth_1 = require("../auth");
function createOrientationEvent(employeeName, startTime, endTime) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const auth = yield (0, auth_1.getOAuthClient)();
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth });
        const event = {
            summary: `Employee Orientation`, // Based on user rewrite "Event: Employee Orientation"
            description: `Welcome to OrgOS! This is your onboarding session for ${employeeName}.`,
            start: {
                dateTime: startTime,
            },
            end: {
                dateTime: endTime,
            },
        };
        const response = yield calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
        });
        return {
            eventId: response.data.id,
            eventUrl: response.data.htmlLink,
            startTime: (_a = response.data.start) === null || _a === void 0 ? void 0 : _a.dateTime,
            endTime: (_b = response.data.end) === null || _b === void 0 ? void 0 : _b.dateTime,
        };
    });
}
