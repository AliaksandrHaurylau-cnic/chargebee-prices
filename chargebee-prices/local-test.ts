import * as dotenv from 'dotenv';
dotenv.config();

import { handler } from './index';


const event = {
    itemFamilyId: 'DoMain-Domains' 
  };

handler(event).then((result: any) => {
    console.log('Lambda handler result:', result);
    }
).catch((err: any) => {
    console.error('Lambda handler error:', err);
});