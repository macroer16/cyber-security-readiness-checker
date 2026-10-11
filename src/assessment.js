// Scoring engine for the Cyber Security Readiness Checker.
// Pure functions only (no DOM), so it can be tested with Node and reused in the browser.
//
// Questions are grouped into the five Cyber Essentials technical controls plus three
// extra areas from the NCSC Small Business Guide (backups, phishing, incident response).
// Each question has a weight: how much damage a gap here typically causes.

export const ANSWERS = Object.freeze({
  yes: 1,       // fully in place
  partly: 0.5,  // in place for some people or systems
  no: 0,        // not in place
  unsure: 0,    // treated as "no": if you don't know, you can't rely on it
});

export const CONTROLS = Object.freeze({
  firewalls: 'Firewalls',
  secureConfig: 'Secure configuration',
  accessControl: 'User access control',
  malware: 'Malware protection',
  patching: 'Security update management',
  backups: 'Backups',
  phishing: 'Phishing and staff awareness',
  incident: 'Incident response',
});

export const QUESTIONS = Object.freeze([
  {
    id: 'mfa',
    control: 'accessControl',
    weight: 3,
    text: 'Is multi-factor authentication (MFA) switched on for email and every cloud service staff use?',
    why: 'Most account takeovers use stolen or guessed passwords. MFA stops a password alone being enough.',
    action: 'Turn on MFA for email first, then every other cloud service. Use an authenticator app rather than SMS where you can.',
  },
  {
    id: 'admin',
    control: 'accessControl',
    weight: 2,
    text: 'Do staff use a normal account day to day, with admin accounts only used when needed?',
    why: 'If an admin account is compromised, the attacker can change anything, including your security settings.',
    action: 'Give everyone a standard account for daily work. Keep admin rights to a few separate accounts used only for admin tasks.',
  },
  {
    id: 'leavers',
    control: 'accessControl',
    weight: 2,
    text: "Are accounts and access removed on a person's last day?",
    why: 'Old accounts are easy to forget and easy to misuse, by ex-staff or by attackers who find them.',
    action: 'Make removing access part of a written leaver checklist, done on the last day and signed off.',
  },
  {
    id: 'patching',
    control: 'patching',
    weight: 3,
    text: 'Are operating systems and apps updated within 14 days of a security update being released?',
    why: 'Attackers scan for devices missing known fixes. Cyber Essentials requires critical updates within 14 days.',
    action: 'Turn on automatic updates everywhere possible and replace devices or software that no longer get updates.',
  },
  {
    id: 'malware',
    control: 'malware',
    weight: 2,
    text: 'Does every laptop and desktop have anti-malware protection switched on and up to date?',
    why: 'Malware protection catches many known threats before they run.',
    action: 'Check every device has built-in protection (such as Microsoft Defender) switched on and updating.',
  },
  {
    id: 'firewall',
    control: 'firewalls',
    weight: 1,
    text: 'Is a firewall switched on for your internet connection and on every device?',
    why: 'Firewalls block connections you never meant to allow.',
    action: "Check the router's firewall is on and changes need a strong password, and that each device's built-in firewall is on.",
  },
  {
    id: 'defaults',
    control: 'secureConfig',
    weight: 1,
    text: 'Have default passwords been changed and unused software or accounts removed?',
    why: 'Default passwords are published online, and unused software is rarely kept up to date.',
    action: 'Change every default password (routers, printers, cameras) and uninstall software nobody uses.',
  },
  {
    id: 'backups',
    control: 'backups',
    weight: 3,
    text: 'Are important files backed up regularly, with a copy kept separate, and has a restore been tested?',
    why: 'Backups are what get you working again after ransomware, theft or a mistake. An untested backup may not restore.',
    action: 'Back up important data automatically, keep one copy separate from your network, and test a restore at least every 3 months.',
  },
  {
    id: 'phishing',
    control: 'phishing',
    weight: 2,
    text: 'Do staff know how to spot and report a phishing email, and feel safe reporting mistakes?',
    why: 'Most attacks start with an email. Quick reporting limits the damage.',
    action: 'Run short phishing awareness training, set up one clear way to report suspicious messages, and thank people who report.',
  },
  {
    id: 'incident',
    control: 'incident',
    weight: 1,
    text: 'Is there a simple written plan for what to do, and who to call, if something goes wrong?',
    why: 'In an incident, a plan stops panic and saves time.',
    action: 'Write a one-page plan: who decides, who to call (IT support, bank, Action Fraud), and how to restore from backup.',
  },
]);

/** Highest possible total score (sum of all weights). */
export const MAX_POINTS = QUESTIONS.reduce((sum, q) => sum + q.weight, 0);

/**
 * Score a set of answers.
 * @param {Record<string, 'yes'|'partly'|'no'|'unsure'>} answers question id -> answer
 * @returns {{score:number, level:string, answered:number, gaps:Array, byControl:Array}}
 */
export function scoreAssessment(answers) {
  let points = 0;
  let answered = 0;
  const gaps = [];

  for (const q of QUESTIONS) {
    const answer = answers[q.id];
    if (answer !== undefined && !(answer in ANSWERS)) {
      throw new Error(`Unknown answer "${answer}" for question "${q.id}"`);
    }
    if (answer !== undefined) answered += 1;
    const value = answer === undefined ? 0 : ANSWERS[answer];
    points += value * q.weight;
    if (value < 1) {
      gaps.push({ ...q, answer: answer ?? 'unanswered', lostPoints: (1 - value) * q.weight });
    }
  }

  // Biggest risks first: most points lost, then highest weight.
  gaps.sort((a, b) => b.lostPoints - a.lostPoints || b.weight - a.weight);

  const score = Math.round((points / MAX_POINTS) * 100);
  return { score, level: levelFor(score), answered, gaps, byControl: controlBreakdown(answers) };
}

/** Plain-English band for a score. */
export function levelFor(score) {
  if (score >= 85) return 'Strong foundation';
  if (score >= 60) return 'Good start, with gaps to fix';
  if (score >= 35) return 'Needs improvement';
  return 'High risk';
}

/** Percentage per control area, so people can see which area is weakest. */
export function controlBreakdown(answers) {
  return Object.entries(CONTROLS).map(([key, name]) => {
    const qs = QUESTIONS.filter((q) => q.control === key);
    const max = qs.reduce((s, q) => s + q.weight, 0);
    const got = qs.reduce((s, q) => s + (answers[q.id] ? ANSWERS[answers[q.id]] : 0) * q.weight, 0);
    return { key, name, percent: Math.round((got / max) * 100) };
  });
}

/** A plain-text action plan the user can download or print. */
export function actionPlanText(result, dateLabel) {
  const lines = [
    'Cyber Security Readiness Checker: action plan',
    `Date: ${dateLabel}`,
    `Score: ${result.score}/100 (${result.level})`,
    '',
  ];
  if (result.gaps.length === 0) {
    lines.push('No gaps found. Review these controls every 6 months, and test your backups.');
  } else {
    lines.push('Fix these in order (biggest risk first):', '');
    result.gaps.forEach((g, i) => {
      lines.push(`${i + 1}. ${g.action}`, `   Why: ${g.why}`, '');
    });
  }
  lines.push(
    'Based on the NCSC Small Business Guide and the Cyber Essentials controls.',
    'This is a self-assessment for learning, not a certified audit.'
  );
  return lines.join('\n');
}
