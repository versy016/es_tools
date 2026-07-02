// Shared Drive Manager — in-memory data + helpers.
// This is a mock layer that mirrors the design prototype so the tool is fully clickable.
// Swap these for a real backend later (a Google Drive edge function): list drives +
// member counts, list a drive's members, directory CRUD, create drive, bulk add/remove
// returning per-item skipped/failed reasons, and an activity feed. The `excluded`
// ("protected") flag must come from the backend.

let _n = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(_n++).toString(36)}`;

export const initials = (first, last) =>
    `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || '?';

// Treat firstname.lastname@ and firstinitiallastname@ (john.smith ↔ jsmith) as one person.
export const samePerson = (a, b) => {
    if (!a || !b) return false;
    if (a.toLowerCase() === b.toLowerCase()) return true;
    const [la, da] = a.toLowerCase().split('@');
    const [lb, db] = b.toLowerCase().split('@');
    if (!da || da !== db) return false;
    if (la === lb) return true;
    if (la.includes('.') && !lb.includes('.')) return lb === la[0] + la.split('.').pop();
    if (lb.includes('.') && !la.includes('.')) return la === lb[0] + lb.split('.').pop();
    return false;
};

const person = (first, last) => {
    const name = `${first} ${last}`;
    return { id: uid('p'), first, last, name, email: `${first}.${last}@engsurveys.com.au`.toLowerCase(), initials: initials(first, last) };
};

export const seedPeople = () => [
    person('Alex', 'Morgan'), person('John', 'Smith'), person('Priya', 'Nair'),
    person('Daniel', 'Corcoran'), person('Sarah', 'Lee'), person('Tom', 'Baker'),
    person('Grace', 'Hall'), person('Liam', 'Nguyen'), person('Chloe', 'Adams'),
    person('Noah', 'Patel'), person('Mia', 'Roberts'), person('Ethan', 'Walsh'),
    person('Ava', 'Kelly'), person('Jack', 'Turner'), person('Ruby', 'Fraser'),
];

// Build the seed drives given the people list (so memberIds reference real people).
export const seedDrives = (people) => {
    const id = (i) => people[i]?.id;
    const drive = (name, excluded, memberIdx, activity) => ({
        id: uid('d'), name, excluded: !!excluded,
        memberIds: memberIdx.map((i) => id(i)).filter(Boolean),
        activity,
    });
    return [
        drive('_A', false, [0, 1, 2, 3, 4], '8m ago'),
        drive('_B', false, [0, 1, 2], '2h ago'),
        drive('_C', false, [0, 1, 2, 5, 6, 7], 'Yesterday'),
        drive('Client Drive – Smith', false, [1, 3, 4], '3d ago'),
        drive('Client Drive – Nguyen', false, [7, 8], '6d ago'),
        drive('Client Drive – Patel', false, [9, 10, 11], '1w ago'),
        drive('Survey 2024', false, [0, 2, 4, 6, 8, 10, 12], '4h ago'),
        drive('As-Built Archive', false, [1, 3, 5], '2w ago'),
        drive('Field Photos', false, [0, 1, 2, 3, 4, 5, 6, 7], '30m ago'),
        drive('Templates', false, [0], '5w ago'),
        drive('DBYD Plans', false, [2, 4, 6], 'Yesterday'),
        drive('Tender Docs', false, [0, 1, 11, 12, 13], '9d ago'),
        drive('Marketing', false, [8, 9], '3w ago'),
        drive('Accounts QT', true, [0, 1], '1mo ago'),   // protected
        drive('Backups', true, [0], '2mo ago'),           // protected
        drive('Management', true, [0, 1], '1mo ago'),     // protected
    ];
};

export const seedActivity = () => {
    const e = (type, title, detail, tone, ts) => ({ id: uid('a'), type, title, detail, tone, ts });
    return [
        e('add', 'Members added', 'Alex Morgan · 4 added to _A', 'ok', '8m ago'),
        e('create', 'Drive created', 'Alex Morgan · “Field Photos”', 'ok', '30m ago'),
        e('remove', 'Members removed', 'Alex Morgan · 2 removed from Survey 2024', 'bad', '2h ago'),
        e('add', 'Members added', 'Alex Morgan · 3 added to Client Drive – Smith', 'ok', '3d ago'),
        e('directory', 'Directory updated', 'Alex Morgan · added Ruby Fraser', 'ok', '5d ago'),
        e('remove', 'Members removed', 'Alex Morgan · 1 removed from DBYD Plans', 'bad', '6d ago'),
    ];
};

// The default member set applied to a newly created drive (first 3 people).
export const defaultMemberIds = (people) => people.slice(0, 3).map((p) => p.id);
