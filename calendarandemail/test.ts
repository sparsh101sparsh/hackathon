import { executeEngineeringAgent } from './agent';
import * as dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  const plan = {
    employeeName: 'Sparsh',
    employeeEmail: 'iamsparshemail02@gmail.com', // Change this to your test email
    orientationStartTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    orientationEndTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
  };

  try {
    const result = await executeEngineeringAgent(plan);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error executing Engineering Agent:', error);
  }
}

runTest();
