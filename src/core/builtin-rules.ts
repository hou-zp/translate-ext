import type { SiteRule } from './config';
import officialRules from '../../rules/official-rules.json';

/**
 * Site rules shipped with the extension (lowest priority tier).
 * Source of truth: rules/official-rules.json in the repo.
 */
export const BUILTIN_RULES: SiteRule[] = officialRules as SiteRule[];
