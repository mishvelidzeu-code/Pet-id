import { supabase } from './supabase';

export const DEFAULT_CLINICS = [
  {
    id: 'seed-clinic-1',
    name: 'ვეტ-ჰაუსი',
    address: 'თბილისი, ვაჟა-ფშაველა #45',
    phone: '0322334455',
    image_url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=500&q=80',
    lat: 41.7289,
    lng: 44.7431,
    is_active: true,
  },
  {
    id: 'seed-clinic-2',
    name: 'ნიუ ვეტი',
    address: 'თბილისი, წერეთლის გამზ. #112',
    phone: '0322998877',
    image_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=500&q=80',
    lat: 41.7355,
    lng: 44.782,
    is_active: true,
  },
  {
    id: 'seed-clinic-3',
    name: 'ვეტ-სერვისი',
    address: 'ქუთაისი, ჭავჭავაძის ქ. #22',
    phone: '0431223344',
    image_url: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=500&q=80',
    lat: 42.2662,
    lng: 42.718,
    is_active: true,
  },
  {
    id: 'seed-clinic-4',
    name: 'ზოო-პლაზა',
    address: 'თბილისი, საბურთალოს ქ. #8',
    phone: '599112233',
    image_url: 'https://images.unsplash.com/photo-1628009368231-7bb7cb2818a7?w=500&q=80',
    lat: 41.725,
    lng: 44.75,
    is_active: true,
  },
];

export const DEFAULT_EVENTS = [
  {
    id: 'seed-event-1',
    title: 'კანე კორსოების შეკრება',
    event_date: '2026-04-12T14:00:00+04:00',
    location: 'ლისის ტბა',
    description:
      'ყველა კანე კორსოს პატრონს ველოდებით შეხვედრაზე. განვიხილავთ მოვლისა და წვრთნის საკითხებს.',
    image_url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=500&q=80',
    is_published: true,
  },
  {
    id: 'seed-event-2',
    title: 'ძაღლების გამოფენა 2026',
    event_date: '2026-05-20T10:00:00+04:00',
    location: 'ექსპო ჯორჯია',
    description:
      'საერთაშორისო გამოფენა ყველა ჯიშისთვის. გამარჯვებულებს გადაეცემათ სპეციალური პრიზები.',
    image_url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=500&q=80',
    is_published: true,
  },
];

export const DEFAULT_CHARITY_POSTS = [
  {
    id: 'seed-charity-1',
    name: 'ბიმბო',
    urgent: true,
    status: 'active',
    condition: 'დაეჯახა ავტომობილი, ესაჭიროება მენჯის ოპერაცია.',
    description:
      'ბიმბო ქუჩის ძაღლია, რომელსაც გუშინ დაეჯახა მანქანა. ვეტერინართან გადავიყვანეთ, თუმცა ოპერაციისთვის და რეაბილიტაციისთვის გვჭირდება თანხის შეგროვება.',
    bank_name: 'საქართველოს ბანკი',
    iban: 'GE12BG0000000123456789',
    receiver: 'გიორგი მაისურაძე (ბიმბოსთვის)',
    image_url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500&q=80',
  },
  {
    id: 'seed-charity-2',
    name: 'ლუსი',
    urgent: false,
    status: 'active',
    condition: 'მიტოვებული ლეკვი, სჭირდება აცრები და საკვები.',
    description:
      'ლუსი ვიპოვეთ პარკში ყუთით მიტოვებული. ამჟამად დროებით თავშესაფარშია. სჭირდება სრული ვაქცინაცია და სპეციალური საკვები ალერგიის გამო.',
    bank_name: 'თიბისი ბანკი',
    iban: 'GE89TB1111111112345678',
    receiver: 'ანა ბერიძე (ლუსისთვის)',
    image_url: 'https://images.unsplash.com/photo-1593134257782-e89567b7718a?w=500&q=80',
  },
  {
    id: 'seed-charity-3',
    name: 'ჯეკო',
    urgent: false,
    status: 'completed',
    condition: 'ურთულესი ოპერაცია წარმატებით დასრულდა!',
    description:
      'თქვენი უდიდესი მხარდაჭერით ჯეკოს მალევე ჩაუტარდა ოპერაცია. ახლა ის თავს შესანიშნავად გრძნობს და მალე ახალ ოჯახშიც გადავა.',
    bank_name: '',
    iban: '',
    receiver: '',
    image_url: 'https://images.unsplash.com/photo-1598133894008-61f7fec814ce?w=500&q=80',
  },
];

export const DEFAULT_ADOPTION_POSTS = [
  {
    id: 'seed-adoption-1',
    name: 'ლუნა',
    breed: 'მეტისი',
    age_label: '8 თვე',
    sex: 'მდედრი',
    location: 'თბილისი, საბურთალო',
    temperament: 'თბილი, ადამიანზე ორიენტირებული და სწრაფად ეჩვევა ოჯახურ გარემოს.',
    description:
      'ლუნა ქუჩიდან გადარჩენილი ლეკვია. აცრილია, ჯანმრთელია და ყველაზე მეტად მშვიდი სახლი სჭირდება, სადაც ყოველდღიური კონტაქტი და გასეირნება ექნება.',
    contact_name: 'ანა',
    contact_phone: '599123456',
    image_url: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=900&q=80',
    is_featured: true,
    is_active: true,
  },
  {
    id: 'seed-adoption-2',
    name: 'ბასტი',
    breed: 'ქუჩის კატა',
    age_label: '1 წელი',
    sex: 'მამრობითი',
    location: 'ბათუმი',
    temperament: 'წყნარი, სუფთა და ბინაში ცხოვრებასაც მარტივად ეგუება.',
    description:
      'ბასტი დროებით გადაყვანილია მზრუნველთან. უყვარს მშვიდი კუთხე, ადამიანთან ჩაწოლა და სტრესის გარეშე ცხოვრობს სხვა კატებთანაც.',
    contact_name: 'ნინო',
    contact_phone: '577100200',
    image_url: 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=900&q=80',
    is_featured: false,
    is_active: true,
  },
  {
    id: 'seed-adoption-3',
    name: 'ტობი',
    breed: 'მეტისი',
    age_label: '2 წელი',
    sex: 'მამრობითი',
    location: 'ქუთაისი',
    temperament: 'აქტიური, მხიარული და ბავშვებთანაც კარგად ურთიერთობს.',
    description:
      'ტობი უკვე მიჩვეულია საყელოსა და საბაზისო ბრძანებებს. სჭირდება ოჯახი, რომელსაც ექნება დრო გასეირნებისთვის და მოთამაშე ოთხფეხა მეგობრისთვის.',
    contact_name: 'გიორგი',
    contact_phone: '555667788',
    image_url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=900&q=80',
    is_featured: false,
    is_active: true,
  },
];

function formatDateParts(value) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      badgeLabel: '',
      fullLabel: '',
    };
  }

  const badgeLabel = new Intl.DateTimeFormat('ka-GE', {
    day: 'numeric',
    month: 'long',
  }).format(parsedDate);

  const timeLabel = new Intl.DateTimeFormat('ka-GE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsedDate);

  return {
    badgeLabel,
    fullLabel: `${badgeLabel}, ${timeLabel}`,
  };
}

function mapClinic(item) {
  return {
    id: item.id,
    name: item.name ?? '',
    address: item.address ?? '',
    phone: item.phone ?? '',
    image_url: item.image_url ?? item.image ?? '',
    lat: typeof item.lat === 'number' ? item.lat : Number(item.lat),
    lng: typeof item.lng === 'number' ? item.lng : Number(item.lng),
    is_active: item.is_active !== false,
    created_at: item.created_at ?? null,
  };
}

function mapEvent(item) {
  const labels = formatDateParts(item.event_date ?? item.date);

  return {
    id: item.id,
    title: item.title ?? '',
    event_date: item.event_date ?? item.date ?? null,
    date: labels.fullLabel,
    date_badge: labels.badgeLabel,
    location: item.location ?? item.loc ?? '',
    description: item.description ?? item.desc ?? '',
    image_url: item.image_url ?? item.image ?? '',
    is_published: item.is_published !== false,
    created_at: item.created_at ?? null,
  };
}

function mapCharity(item) {
  return {
    id: item.id,
    name: item.name ?? '',
    urgent: Boolean(item.urgent),
    status: item.status === 'completed' ? 'completed' : 'active',
    condition: item.condition ?? '',
    description: item.description ?? '',
    bank_name: item.bank_name ?? item.bankName ?? '',
    iban: item.iban ?? '',
    receiver: item.receiver ?? '',
    image_url: item.image_url ?? item.image ?? '',
    created_at: item.created_at ?? null,
  };
}

function mapAdoption(item) {
  return {
    id: item.id,
    name: item.name ?? '',
    breed: item.breed ?? '',
    age_label: item.age_label ?? '',
    sex: item.sex ?? '',
    location: item.location ?? '',
    temperament: item.temperament ?? '',
    description: item.description ?? '',
    contact_name: item.contact_name ?? '',
    contact_phone: item.contact_phone ?? '',
    image_url: item.image_url ?? item.image ?? '',
    is_featured: Boolean(item.is_featured),
    is_active: item.is_active !== false,
    created_at: item.created_at ?? null,
  };
}

function normalizeRows(rows, mapper) {
  return (rows ?? []).map(mapper);
}

export async function fetchPublicClinics() {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: normalizeRows(DEFAULT_CLINICS, mapClinic), error };
  }

  return { data: normalizeRows(data, mapClinic), error: null };
}

export async function fetchPublicEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_published', true)
    .order('event_date', { ascending: true });

  if (error) {
    return { data: normalizeRows(DEFAULT_EVENTS, mapEvent), error };
  }

  return { data: normalizeRows(data, mapEvent), error: null };
}

export async function fetchPublicCharityPosts() {
  const { data, error } = await supabase
    .from('charity_posts')
    .select('*')
    .order('created_at', { ascending: false });

  const rows = error ? DEFAULT_CHARITY_POSTS : data;
  const normalized = normalizeRows(rows, mapCharity);

  return {
    activePosts: normalized.filter((item) => item.status !== 'completed'),
    completedPosts: normalized.filter((item) => item.status === 'completed'),
    error,
  };
}

export async function fetchPublicAdoptionPosts() {
  const { data, error } = await supabase
    .from('adoption_posts')
    .select('*')
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false });

  const rows = error ? DEFAULT_ADOPTION_POSTS : data;
  return { data: normalizeRows(rows, mapAdoption), error };
}

export async function fetchAdminClinics() {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .order('created_at', { ascending: false });

  return { data: normalizeRows(data, mapClinic), error };
}

export async function fetchAdminEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true });

  return { data: normalizeRows(data, mapEvent), error };
}

export async function fetchAdminCharityPosts() {
  const { data, error } = await supabase
    .from('charity_posts')
    .select('*')
    .order('created_at', { ascending: false });

  return { data: normalizeRows(data, mapCharity), error };
}

export async function fetchAdminAdoptionPosts() {
  const { data, error } = await supabase
    .from('adoption_posts')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false });

  return { data: normalizeRows(data, mapAdoption), error };
}

export function buildEventDate(dateText, timeText) {
  if (!dateText?.trim()) {
    throw new Error('მიუთითე თარიღი ფორმატით YYYY-MM-DD.');
  }

  const time = timeText?.trim() || '12:00';
  const isoValue = `${dateText.trim()}T${time}:00+04:00`;
  const parsed = new Date(isoValue);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('ივენთის თარიღი ან დრო არასწორია.');
  }

  return parsed.toISOString();
}
