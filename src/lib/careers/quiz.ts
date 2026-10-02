/**
 * The "find your direction" quiz. Each answer adds points to the career paths
 * it points towards; the result is the top three, ties broken by catalogue
 * order (which runs from most to least beginner-friendly). Deterministic and
 * transparent: the result page shows why each path was suggested.
 */
import { CAREERS } from '@/lib/careers/catalog';

export interface QuizOption {
  id: string;
  label: string;
  /** Career slug -> points. */
  points: Record<string, number>;
  /** Shown on the result as the reason this answer counted. */
  reason: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
}

export const QUIZ: QuizQuestion[] = [
  {
    id: 'enjoy',
    question: 'Which of these sounds most interesting?',
    options: [
      { id: 'investigate', label: 'Investigating something suspicious to find out what happened', points: { 'soc-analyst': 3, 'incident-response': 3 }, reason: 'you enjoy investigating' },
      { id: 'build', label: 'Building and configuring systems so they work securely', points: { 'security-engineer': 3, 'cloud-security': 3, 'iam-analyst': 1 }, reason: 'you enjoy building systems' },
      { id: 'break', label: 'Figuring out how to break into things (legally)', points: { 'penetration-tester': 3, 'application-security': 2, 'vulnerability-management': 1 }, reason: 'you enjoy finding weaknesses' },
      { id: 'organise', label: 'Organising rules, risks and documents so everything is in order', points: { 'grc-analyst': 3, 'iam-analyst': 1 }, reason: 'you enjoy organising and governance' },
      { id: 'help', label: 'Helping people fix their technology problems', points: { 'it-support': 3, 'iam-analyst': 1 }, reason: 'you enjoy helping people' },
    ],
  },
  {
    id: 'background',
    question: 'What is your background so far?',
    options: [
      { id: 'none', label: 'New to tech — student, recent graduate or changing careers', points: { 'it-support': 2, 'soc-analyst': 2, 'grc-analyst': 1 }, reason: 'you are starting out' },
      { id: 'it', label: 'IT support, help desk or system administration', points: { 'soc-analyst': 2, 'iam-analyst': 2, 'security-engineer': 2, 'vulnerability-management': 1 }, reason: 'you have IT experience' },
      { id: 'dev', label: 'Software development or scripting', points: { 'application-security': 3, 'cloud-security': 2, 'penetration-tester': 1 }, reason: 'you can code' },
      { id: 'cloud', label: 'Cloud, networking or infrastructure', points: { 'cloud-security': 3, 'security-engineer': 2, 'vulnerability-management': 1 }, reason: 'you know infrastructure' },
      { id: 'business', label: 'Business, audit, finance, law or project management', points: { 'grc-analyst': 3 }, reason: 'you have a business background' },
    ],
  },
  {
    id: 'pace',
    question: 'What kind of workday suits you?',
    options: [
      { id: 'fast', label: 'Fast-paced — reacting to whatever comes in', points: { 'soc-analyst': 2, 'incident-response': 2, 'it-support': 1 }, reason: 'you like a fast pace' },
      { id: 'projects', label: 'Planned projects with clear goals', points: { 'cloud-security': 1, 'security-engineer': 2, 'grc-analyst': 1, 'iam-analyst': 1 }, reason: 'you like project work' },
      { id: 'deep', label: 'Long stretches of deep, focused problem-solving', points: { 'penetration-tester': 2, 'application-security': 1, 'incident-response': 1 }, reason: 'you like deep focus' },
    ],
  },
  {
    id: 'people',
    question: 'How much do you want to work with people?',
    options: [
      { id: 'lots', label: 'A lot — I like explaining things and working with others', points: { 'it-support': 2, 'grc-analyst': 2, 'application-security': 1 }, reason: 'you enjoy working with people' },
      { id: 'some', label: 'Some — a mix of team work and solo work', points: { 'iam-analyst': 1, 'vulnerability-management': 2, 'cloud-security': 1, 'soc-analyst': 1 }, reason: 'you like a mix of people and solo work' },
      { id: 'little', label: 'Not much — I prefer to focus on technical work', points: { 'penetration-tester': 1, 'security-engineer': 1, 'incident-response': 1 }, reason: 'you prefer technical focus' },
    ],
  },
  {
    id: 'code',
    question: 'How do you feel about coding?',
    options: [
      { id: 'enjoy', label: 'I enjoy it or want to get good at it', points: { 'application-security': 2, 'cloud-security': 2, 'penetration-tester': 1, 'security-engineer': 1 }, reason: 'you enjoy coding' },
      { id: 'ok', label: 'A little scripting is fine', points: { 'soc-analyst': 1, 'vulnerability-management': 1, 'iam-analyst': 1, 'incident-response': 1 }, reason: 'light scripting suits you' },
      { id: 'avoid', label: 'I would rather avoid it', points: { 'grc-analyst': 2, 'it-support': 1 }, reason: 'you prefer roles with little coding' },
    ],
  },
];

export interface QuizResult {
  slug: string;
  points: number;
  /** The answers that pointed here, in plain words. */
  reasons: string[];
}

/** Top three paths for a set of answers (question id -> option id). */
export function scoreQuiz(answers: Record<string, string>): QuizResult[] {
  const totals = new Map<string, QuizResult>(CAREERS.map((c) => [c.slug, { slug: c.slug, points: 0, reasons: [] }]));
  for (const q of QUIZ) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (!opt) continue;
    for (const [slug, pts] of Object.entries(opt.points)) {
      const t = totals.get(slug);
      if (!t) continue;
      t.points += pts;
      t.reasons.push(opt.reason);
    }
  }
  const order = new Map(CAREERS.map((c, i) => [c.slug, i]));
  return [...totals.values()]
    .filter((t) => t.points > 0)
    .sort((a, b) => b.points - a.points || (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0))
    .slice(0, 3);
}
