import { JOLT_ROUTES } from '../shared/constants.ts';

/**
 * Generates the fetch interceptor and real-time mock engine.
 * Allows agents to simulate HTTP 4xx/5xx/timeouts on the fly without backend edits.
 */
export function buildNetworkInterceptorScript(enabled = true): string {
  return `
  let activeMockRules = [];
  const origFetch = window.fetch.bind(window);
  const mocksInterceptorEnabled = ${enabled};

  function setNetworkMocks(rules) {
    activeMockRules = mocksInterceptorEnabled && Array.isArray(rules) ? rules.map((r) => ({ ...r })) : [];
    notifyHudUpdate();
  }

  function getNetworkMocks() {
    return activeMockRules;
  }

  function matchMockRule(url, method) {
    for (let i = 0; i < activeMockRules.length; i++) {
      const rule = activeMockRules[i];
      if (rule.active === false) continue;
      if (rule.method && rule.method.toUpperCase() !== method) continue;
      const pattern = String(rule.urlPattern || '');
      if (!pattern) continue;
      if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
        try {
          const re = new RegExp(pattern.slice(1, -1));
          if (re.test(url)) return rule;
        } catch {
          if (url.includes(pattern)) return rule;
        }
      } else if (url.includes(pattern)) {
        return rule;
      }
    }
    return null;
  }

  if (mocksInterceptorEnabled) {
    window.fetch = async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : (input instanceof Request ? input.url : String(input));
    const method = ((init && init.method) || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // Never intercept Jolt's internal telemetry endpoints.
    if (url.includes('/__jolt/') || url.includes('${JOLT_ROUTES.PROBE_SCRIPT}')) {
      return origFetch(input, init);
    }

    const matchedRule = matchMockRule(url, method);
    if (matchedRule) {
      matchedRule.hitCount = (matchedRule.hitCount || 0) + 1;
      if (matchedRule.delayMs && matchedRule.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, matchedRule.delayMs));
      }
      const cleanPath = url.replace(window.location.origin, '');
      pushFlightEvent(
        'mock',
        method + ' ' + cleanPath + ' -> MOCK ' + matchedRule.status,
        undefined,
        { ruleId: matchedRule.id, status: matchedRule.status }
      );
      if (matchedRule.status >= 400) {
        pushFlightEvent(
          'fetch',
          method + ' ' + cleanPath + ' -> ' + matchedRule.status + ' (mocked)',
          undefined,
          { status: matchedRule.status, mocked: true }
        );
      }
      scheduleBackgroundReport('mock-hit');
      const bodyStr = JSON.stringify(
        matchedRule.responseBody !== undefined ? matchedRule.responseBody : { mocked: true }
      );
      return new Response(bodyStr, {
        status: matchedRule.status,
        statusText: 'Jolt Mock ' + matchedRule.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Jolt-Mock': matchedRule.id,
        },
      });
    }

    const startedAt = performance.now();
    try {
      const response = await origFetch(input, init);
      if (!response.ok) {
        const cleanPath = url.replace(window.location.origin, '');
        pushFlightEvent(
          'fetch',
          method + ' ' + cleanPath + ' -> ' + response.status,
          undefined,
          { status: response.status, durationMs: Math.round(performance.now() - startedAt) }
        );
      }
      return response;
    } catch (err) {
      const cleanPath = url.replace(window.location.origin, '');
      pushFlightEvent(
        'fetch',
        method + ' ' + cleanPath + ' -> NETWORK ERROR',
        undefined,
        { error: err instanceof Error ? err.message : String(err) }
      );
      throw err;
    }
    };
  }
`;
}
