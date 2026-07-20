import { forwardBrainRequest } from './_shared.js';

export default {
  fetch(request: Request) {
    return forwardBrainRequest(request, '/api/ai/analyze-page');
  },
};
