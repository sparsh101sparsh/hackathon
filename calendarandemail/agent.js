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
exports.executeEngineeringAgent = executeEngineeringAgent;
const calendarService_1 = require("./services/calendarService");
const mailService_1 = require("./services/mailService");
function executeEngineeringAgent(plan) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Engineering Agent started execution for:', plan.employeeName);
        // 1. Create Calendar Event
        console.log('Creating calendar event...');
        const calendarResponse = yield (0, calendarService_1.createOrientationEvent)(plan.employeeName, plan.orientationStartTime, plan.orientationEndTime);
        console.log('Calendar event created:', calendarResponse.eventUrl);
        // 2. Send Email
        console.log('Sending welcome email...');
        yield (0, mailService_1.sendWelcomeEmail)(plan.employeeEmail, plan.employeeName, calendarResponse.eventUrl || '');
        console.log('Welcome email sent.');
        // 3. Return Notion-ready update
        return {
            "GitHub Invite": true,
            "Calendar Event": true,
            "Calendar URL": calendarResponse.eventUrl,
            "Email Sent": true,
            "Status": "Completed"
        };
    });
}
