import { Form, Formik } from 'formik';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import * as Yup from 'yup';
import { db } from './db';
import {
  currencyFormatter,
  formatDateHuman,
  formatDateShort,
  getCurrentDateISO,
  getCurrentMonthISO,
  percentFormatter,
} from './utils/format';
import { DailyMetrics, GoldItem, PawnRecord, Role } from './types';

interface GoldFormValues {
  name: string;
  price: number | '';
  image: string;
}

interface PawnFormValues {
  customerName: string;
  principal: number | '';
  interestRate: number | '';
  term: number | '';
  date: string;
}

interface LoginFormValues {
  role: Role;
  username: string;
  password: string;
}

const credentials: Record<Role, { username: string; password: string }> = {
  admin: { username: 'admin', password: 'admin123' },
  'data-admin': { username: 'dataman', password: 'data123' },
  client: { username: 'client', password: 'client123' },
};

const roleLabels: Record<Role, string> = {
  admin: 'Shop Admin',
  'data-admin': 'Pawn Data Admin',
  client: 'Client Viewer',
};

const GOLD_STORAGE_KEY = 'ukgoldshop_inventory';
const PAWN_STORAGE_KEY = 'ukgoldshop_pawn_records';

const goldValidationSchema = Yup.object({
  name: Yup.string().required('Gold name is required'),
  price: Yup.number().typeError('Enter a numeric price').positive('Price must be positive').required('Price is required'),
  image: Yup.string().required('Please upload an image'),
});

const pawnValidationSchema = Yup.object({
  customerName: Yup.string().required('Customer name is required'),
  principal: Yup.number()
    .typeError('Enter a numeric principal')
    .positive('Principal must be positive')
    .required('Principal is required'),
  interestRate: Yup.number()
    .typeError('Enter an interest rate')
    .positive('Interest rate must be positive')
    .max(100, 'Interest rate is too high')
    .typeError('Select an interest rate')
    .min(0.005, 'Interest rate must be positive')
    .required('Interest rate is required'),
  term: Yup.number().typeError('Term must be a number').min(1, 'Term must be at least 1 month').required('Loan term is required'),
  date: Yup.string().required('Transaction date is required'),
});

const loginValidationSchema = Yup.object({
  role: Yup.mixed<Role>().oneOf(['admin', 'data-admin', 'client']).required(),
  username: Yup.string().required('Username is required'),
  password: Yup.string().required('Password is required'),
});

const interestOptions = [0.015, 0.02, 0.025, 0.03, 0.035, 0.04];

function encodeFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function safeReadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Unable to parse storage key ${key}`, error);
    return fallback;
  }
}

function calculateDailyMetrics(records: PawnRecord[], isoDate: string): DailyMetrics {
  const matches = records.filter((record) => record.date === isoDate);
  return matches.reduce<DailyMetrics>(
    (acc, record) => {
      acc.count += 1;
      acc.principal += record.principal;
      acc.interest += record.monthlyInterest * record.term;
      return acc;
    },
    { count: 0, principal: 0, interest: 0 },
  );
}

function calculateMonthlyMetrics(records: PawnRecord[], isoMonth: string): DailyMetrics {
  const matches = records.filter((record) => record.date.startsWith(isoMonth));
  return matches.reduce<DailyMetrics>(
    (acc, record) => {
      acc.count += 1;
      acc.principal += record.principal;
      acc.interest += record.monthlyInterest * record.term;
      return acc;
    },
    { count: 0, principal: 0, interest: 0 },
  );
}

export default function App(): JSX.Element {
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [dataAdminView, setDataAdminView] = useState<'capture' | 'analysis'>('capture');
  const [goldItems, setGoldItems] = useState<GoldItem[]>([]);
  const [pawnRecords, setPawnRecords] = useState<PawnRecord[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState<string>(() => getCurrentDateISO());
  const [monthlySelection, setMonthlySelection] = useState<string>(() => getCurrentMonthISO());
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const [storedGold, storedPawn] = await Promise.all([
          db.goldItems.toArray(),
          db.pawnRecords.toArray(),
        ]);
        if (!cancelled) {
          setGoldItems(storedGold);
          setPawnRecords(storedPawn);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingData(false);
        }
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeRole !== 'data-admin') {
      setDataAdminView('capture');
    }
  }, [activeRole]);

  const dailyMetrics = useMemo(() => calculateDailyMetrics(pawnRecords, dailyDate), [pawnRecords, dailyDate]);
  const monthlyMetrics = useMemo(
    () => calculateMonthlyMetrics(pawnRecords, monthlySelection),
    [pawnRecords, monthlySelection],
  );

  const todaysRecords = useMemo(
    () => pawnRecords.filter((record) => record.date === dailyDate),
    [pawnRecords, dailyDate],
  );

  const todaysBorrowers = useMemo(() => new Set(todaysRecords.map((record) => record.customerName)).size, [todaysRecords]);

  const todaysPieData = useMemo(() => {
    if (todaysRecords.length === 0) return [];
    const palette = ['#2563eb', '#f59e0b', '#10b981', '#ec4899', '#6366f1'];
    const sortedByPrincipal = [...todaysRecords].sort((a, b) => b.principal - a.principal);
    const maxVisible = 4;
    const topRecords = sortedByPrincipal.slice(0, maxVisible);
    const remainder = sortedByPrincipal.slice(maxVisible);
    const slices = topRecords.map((record, index) => ({
      label: record.customerName,
      value: record.principal,
      color: palette[index % palette.length],
    }));
    const remainderTotal = remainder.reduce((sum, record) => sum + record.principal, 0);
    if (remainderTotal > 0) {
      slices.push({
        label: 'Other borrowers',
        value: remainderTotal,
        color: palette[slices.length % palette.length],
      });
    }
    return slices;
  }, [todaysRecords]);

  const monthlyLabel = useMemo(() => {
    const displayDate = new Date(`${monthlySelection}-01T00:00:00`);
    if (Number.isNaN(displayDate.getTime())) {
      return 'Select a month';
    }
    return displayDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }, [monthlySelection]);

  const sortedGold = useMemo(
    () => [...goldItems].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()),
    [goldItems],
  );

  const sortedPawn = useMemo(
    () => [...pawnRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [pawnRecords],
  );

  const handleLogin = (values: LoginFormValues) => {
    const { role, username, password } = values;
    const expected = credentials[role];
    if (expected.username === username.trim() && expected.password === password) {
      setActiveRole(role);
      setLoginError(null);
    } else {
      setLoginError('Invalid credentials. Please try again.');
    }
  };

  const handleLogout = () => {
    setActiveRole(null);
  };

  const handleGoldSubmit = async (values: GoldFormValues) => {
    const newItem: GoldItem = {
      id: crypto.randomUUID(),
      name: values.name.trim(),
      price: Number(values.price),
      image: values.image,
      uploadedAt: new Date().toISOString(),
    };

    await db.goldItems.put(newItem);
    setGoldItems((prev) => [newItem, ...prev]);
  };

  const handlePawnSubmit = async (values: PawnFormValues) => {
    const principal = Number(values.principal);
    const interestRate = Number(values.interestRate);
    const term = Number(values.term);
    const monthlyInterest = principal * interestRate;
    const totalPayable = principal + monthlyInterest * term;

    const newRecord: PawnRecord = {
      id: crypto.randomUUID(),
      customerName: values.customerName.trim(),
      principal,
      interestRate,
      term,
      monthlyInterest,
      totalPayable,
      date: values.date,
      createdAt: new Date().toISOString(),
    };

    await db.pawnRecords.put(newRecord);
    setPawnRecords((prev) => [newRecord, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-brand-600">UK Gold Shop</p>
            <h1 className="text-2xl font-semibold text-slate-900">Admin & Pawn Operations Portal</h1>
          </div>
          {activeRole && (
            <div className="flex items-center gap-4">
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
                {roleLabels[activeRole]}
              </span>
              <button type="button" onClick={handleLogout} className="bg-slate-900 hover:bg-slate-800">
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {!activeRole ? (
        <div className="mx-auto flex min-h-[calc(100vh-140px)] w-full max-w-6xl items-center justify-center px-4">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-2xl backdrop-blur">
            <div className="border-b border-slate-200 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 px-8 py-6 text-white">
              <h2 className="text-xl font-semibold">Welcome back</h2>
              <p className="mt-1 text-sm text-brand-50/80">Choose your workspace role and enter the provided credentials.</p>
            </div>
            <div className="px-8 py-8">
              <Formik<LoginFormValues>
                initialValues={{ role: 'admin', username: '', password: '' }}
                validationSchema={loginValidationSchema}
                onSubmit={handleLogin}
              >
                {({ values, handleChange, errors, touched }) => {
                  const handleFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
                    if (loginError) {
                      setLoginError(null);
                    }
                    return handleChange(event);
                  };

                  return (
                    <Form className="space-y-6">
                      <div className="space-y-2">
                        <label htmlFor="role">Role</label>
                        <select id="role" name="role" value={values.role} onChange={handleFieldChange}>
                          <option value="admin">Shop Admin</option>
                          <option value="data-admin">Pawn Data Admin</option>
                          <option value="client">Client Viewer</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="username">Username</label>
                        <input
                          id="username"
                          name="username"
                          type="text"
                          autoComplete="username"
                          value={values.username}
                          onChange={handleFieldChange}
                          aria-invalid={Boolean(touched.username && errors.username)}
                        />
                        {touched.username && errors.username && (
                          <p className="text-sm text-rose-600">{errors.username}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="password">Password</label>
                        <input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          value={values.password}
                          onChange={handleFieldChange}
                          aria-invalid={Boolean(touched.password && errors.password)}
                        />
                        {touched.password && errors.password && (
                          <p className="text-sm text-rose-600">{errors.password}</p>
                        )}
                      </div>
                      {loginError && (
                        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{loginError}</p>
                      )}
                      <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">Default credentials</p>
                        <ul className="mt-2 space-y-1">
                          <li>Shop Admin · admin / admin123</li>
                          <li>Pawn Data · dataman / data123</li>
                          <li>Client Viewer · client / client123</li>
                        </ul>
                      </div>
                      <button type="submit" className="w-full">Sign in</button>
                    </Form>
                  );
                }}
              </Formik>
            </div>
          </div>
        </div>
      ) : (
        <main className="mx-auto w-full max-w-6xl space-y-10 px-4 pb-16 pt-10">
          {isLoadingData && (
            <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 px-4 py-3 text-sm text-brand-800">
              Loading the latest records from the indexed database...
            </div>
          )}
          {activeRole === 'admin' ? (
            <section className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Upload gold inventory</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Add new jewellery listings with pricing and an image preview.
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
                    Inventory
                  </span>
                </div>
                <Formik<GoldFormValues>
                  initialValues={{ name: '', price: '', image: '' }}
                  validationSchema={goldValidationSchema}
                  onSubmit={async (values, helpers) => {
                    await handleGoldSubmit(values);
                    helpers.resetForm();
                  }}
                >
                  {({ values, setFieldValue, errors, touched, isSubmitting }) => (
                    <Form className="mt-6 space-y-5">
                      <div className="space-y-2">
                        <label htmlFor="name">Gold name</label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          value={values.name}
                          onChange={(event) => setFieldValue('name', event.target.value)}
                          aria-invalid={Boolean(touched.name && errors.name)}
                        />
                        {touched.name && errors.name && <p className="text-sm text-rose-600">{errors.name}</p>}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label htmlFor="price">Price (MMK)</label>
                          <input
                            id="price"
                            name="price"
                            type="number"
                            min="0"
                            value={values.price}
                            onChange={(event) => setFieldValue('price', event.target.value ? Number(event.target.value) : '')}
                            aria-invalid={Boolean(touched.price && errors.price)}
                          />
                          {touched.price && errors.price && <p className="text-sm text-rose-600">{errors.price}</p>}
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="image">Gold image</label>
                          <input
                            id="image"
                            name="image"
                            type="file"
                            accept="image/*"
                            onChange={async (event) => {
                              const [file] = event.currentTarget.files ?? [];
                              if (!file) return;
                              const dataUrl = await encodeFile(file);
                              setFieldValue('image', dataUrl);
                            }}
                          />
                          {touched.image && errors.image && <p className="text-sm text-rose-600">{errors.image}</p>}
                          {values.image && (
                            <div className="mt-2 flex items-center gap-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-700">
                              <img src={values.image} alt={values.name || 'Preview'} className="h-12 w-12 rounded object-cover" />
                              <p>Preview ready. Submit to add item.</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                        Save to inventory
                      </button>
                    </Form>
                  )}
                </Formik>
              </div>
              <div className="table-card">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <h3 className="text-base font-semibold text-slate-800">Latest uploads</h3>
                  <p className="text-sm text-slate-600">Keep track of all jewellery listed for sale.</p>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  <table>
                    <thead>
                      <tr>
                        <th className="w-28">Image</th>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Uploaded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedGold.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                            No gold items uploaded yet.
                          </td>
                        </tr>
                      ) : (
                        sortedGold.map((item) => (
                          <tr key={item.id} className="odd:bg-white even:bg-slate-50">
                            <td>
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                              />
                            </td>
                            <td className="font-medium text-slate-800">{item.name}</td>
                            <td>{currencyFormatter.format(item.price)}</td>
                            <td className="text-slate-500">{formatDateShort(item.uploadedAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : activeRole === 'client' ? (
            <section className="space-y-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-brand-600">Available gold</p>
                    <h2 className="text-xl font-semibold text-slate-900">Latest showroom listings</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Review live prices (MMK) and imagery published by the admin team.
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
                    Client view
                  </span>
                </div>
              </div>
              {sortedGold.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
                  No gold has been published yet. Please check back soon.
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedGold.map((item) => (
                    <article key={item.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                      <img src={item.image} alt={item.name} className="h-48 w-full object-cover" />
                      <div className="flex flex-1 flex-col gap-3 p-5">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                          <p className="text-sm text-slate-500">Uploaded {formatDateShort(item.uploadedAt)}</p>
                        </div>
                        <p className="text-2xl font-bold text-brand-700">{currencyFormatter.format(item.price)}</p>
                        <p className="text-xs text-slate-500">All prices shown in Myanmar Kyat (MMK).</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-brand-600">Pawn operations</p>
                  <h2 className="text-xl font-semibold text-slate-900">Manage lending records</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Capture new pledges or review performance insights in the analysis workspace.
                  </p>
                </div>
                <div className="flex gap-2 rounded-full bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setDataAdminView('capture')}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      dataAdminView === 'capture'
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    aria-pressed={dataAdminView === 'capture'}
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataAdminView('analysis')}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      dataAdminView === 'analysis'
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    aria-pressed={dataAdminView === 'analysis'}
                  >
                    Analysis
                  </button>
                </div>
              </div>

              {dataAdminView === 'capture' ? (
                <>
                  <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Capture pawn transaction</h3>
                          <p className="mt-1 text-sm text-slate-600">
                            Store customer pledges with automatic monthly interest calculations.
                          </p>
                        </div>
                        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
                          Pawn desk
                        </span>
                      </div>
                      <Formik<PawnFormValues>
                        initialValues={{
                          customerName: '',
                          principal: '',
                          interestRate: interestOptions[2],
                          term: 6,
                          date: getCurrentDateISO(),
                        }}
                        validationSchema={pawnValidationSchema}
                        onSubmit={async (values, helpers) => {
                          await handlePawnSubmit(values);
                          helpers.resetForm({
                            values: {
                              customerName: '',
                              principal: '',
                              interestRate: interestOptions[2],
                              term: 6,
                              date: getCurrentDateISO(),
                            },
                          });
                        }}
                      >
                        {({ values, setFieldValue, errors, touched, isSubmitting }) => (
                          <Form className="mt-6 space-y-5">
                            <div className="space-y-2">
                              <label htmlFor="customerName">Customer name</label>
                              <input
                                id="customerName"
                                name="customerName"
                                type="text"
                                value={values.customerName}
                                onChange={(event) => setFieldValue('customerName', event.target.value)}
                                aria-invalid={Boolean(touched.customerName && errors.customerName)}
                              />
                              {touched.customerName && errors.customerName && (
                                <p className="text-sm text-rose-600">{errors.customerName}</p>
                              )}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <label htmlFor="principal">Principal (MMK)</label>
                                <input
                                  id="principal"
                                  name="principal"
                                  type="number"
                                  min="0"
                                  value={values.principal}
                                  onChange={(event) =>
                                    setFieldValue('principal', event.target.value ? Number(event.target.value) : '')
                                  }
                                  aria-invalid={Boolean(touched.principal && errors.principal)}
                                />
                                {touched.principal && errors.principal && (
                                  <p className="text-sm text-rose-600">{errors.principal}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <label htmlFor="interestRate">Monthly interest rate</label>
                                <select
                                  id="interestRate"
                                  name="interestRate"
                                  value={values.interestRate}
                                  onChange={(event) =>
                                    setFieldValue('interestRate', event.target.value ? Number(event.target.value) : '')
                                  }
                                  aria-invalid={Boolean(touched.interestRate && errors.interestRate)}
                                >
                                  {interestOptions.map((rate) => (
                                    <option key={rate} value={rate}>
                                      {percentFormatter.format(rate)}
                                    </option>
                                  ))}
                                </select>
                                {touched.interestRate && errors.interestRate && (
                                  <p className="text-sm text-rose-600">{errors.interestRate}</p>
                                )}
                              </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <label htmlFor="term">Loan term (months)</label>
                                <input
                                  id="term"
                                  name="term"
                                  type="number"
                                  min="1"
                                  value={values.term}
                                  onChange={(event) =>
                                    setFieldValue('term', event.target.value ? Number(event.target.value) : '')
                                  }
                                  aria-invalid={Boolean(touched.term && errors.term)}
                                />
                                {touched.term && errors.term && <p className="text-sm text-rose-600">{errors.term}</p>}
                              </div>
                              <div className="space-y-2">
                                <label htmlFor="date">Transaction date</label>
                                <input
                                  id="date"
                                  name="date"
                                  type="date"
                                  value={values.date}
                                  onChange={(event) => setFieldValue('date', event.target.value)}
                                  aria-invalid={Boolean(touched.date && errors.date)}
                                />
                                {touched.date && errors.date && <p className="text-sm text-rose-600">{errors.date}</p>}
                              </div>
                            </div>
                            <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                              <h4 className="font-semibold text-slate-800">Monthly summary</h4>
                              <p>
                                Interest payable each month:{' '}
                                <span className="font-medium text-slate-900">
                                  {values.principal && values.interestRate
                                    ? currencyFormatter.format(Number(values.principal) * Number(values.interestRate))
                                    : '—'}
                                </span>
                              </p>
                              <p>
                                Total payable:{' '}
                                <span className="font-medium text-slate-900">
                                  {values.principal && values.interestRate && values.term
                                    ? currencyFormatter.format(
                                        Number(values.principal) +
                                          Number(values.principal) * Number(values.interestRate) * Number(values.term),
                                      )
                                    : '—'}
                                </span>
                              </p>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                              Save pawn record
                            </button>
                          </Form>
                        )}
                      </Formik>
                    </div>
                    <div className="table-card">
                      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                        <h3 className="text-base font-semibold text-slate-800">Recent pawn transactions</h3>
                        <p className="text-sm text-slate-600">Entries are ordered by newest first.</p>
                      </div>
                      <div className="max-h-[520px] overflow-y-auto">
                        <table>
                          <thead>
                            <tr>
                              <th>Customer</th>
                              <th>Principal</th>
                              <th>Interest %</th>
                              <th>Monthly interest</th>
                              <th>Total payable</th>
                              <th>Date</th>
                              <th>Term</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedPawn.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                                  No pawn records yet. Capture your first transaction above.
                                </td>
                              </tr>
                            ) : (
                              sortedPawn.map((record) => (
                                <tr key={record.id} className="odd:bg-white even:bg-slate-50">
                                  <td className="font-medium text-slate-800">{record.customerName}</td>
                                  <td>{currencyFormatter.format(record.principal)}</td>
                                  <td>{percentFormatter.format(record.interestRate)}</td>
                                  <td>{currencyFormatter.format(record.monthlyInterest)}</td>
                                  <td>{currencyFormatter.format(record.totalPayable)}</td>
                                  <td className="text-slate-500">{formatDateShort(record.date)}</td>
                                  <td>{record.term} mo</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <DataAnalysisSection
                  dailyDate={dailyDate}
                  onDailyDateChange={setDailyDate}
                  monthlySelection={monthlySelection}
                  onMonthlySelectionChange={setMonthlySelection}
                  dailyMetrics={dailyMetrics}
                  monthlyMetrics={monthlyMetrics}
                  monthlyLabel={monthlyLabel}
                  todaysBorrowers={todaysBorrowers}
                  todaysPieData={todaysPieData}
                  todaysRecords={todaysRecords}
                />
              )}
            </section>
          )}
        </main>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  accent?: string;
}

function MetricCard({ label, value, accent }: MetricCardProps) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-800 shadow-sm ${accent ?? ''}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface DataAnalysisSectionProps {
  dailyDate: string;
  onDailyDateChange: (value: string) => void;
  monthlySelection: string;
  onMonthlySelectionChange: (value: string) => void;
  dailyMetrics: DailyMetrics;
  monthlyMetrics: DailyMetrics;
  monthlyLabel: string;
  todaysBorrowers: number;
  todaysPieData: PieSlice[];
  todaysRecords: PawnRecord[];
}

function DataAnalysisSection({
  dailyDate,
  onDailyDateChange,
  monthlySelection,
  onMonthlySelectionChange,
  dailyMetrics,
  monthlyMetrics,
  monthlyLabel,
  todaysBorrowers,
  todaysPieData,
  todaysRecords,
}: DataAnalysisSectionProps) {
  const pieTotal = todaysPieData.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-brand-600">Today&apos;s overview</p>
              <h3 className="text-xl font-semibold text-slate-900">Daily performance</h3>
              <p className="mt-1 text-sm text-slate-600">Monitor lending activity for a specific date.</p>
            </div>
            <input
              type="date"
              value={dailyDate}
              onChange={(event) => onDailyDateChange(event.target.value)}
              className="w-44"
            />
          </div>
          <p className="mt-3 text-sm text-slate-600">{formatDateHuman(dailyDate)}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Transactions" value={dailyMetrics.count.toString()} accent="bg-brand-50 text-brand-700" />
            <MetricCard
              label="Principal today"
              value={currencyFormatter.format(dailyMetrics.principal)}
              accent="bg-brand-50 text-brand-700"
            />
            <MetricCard label="Borrowers" value={todaysBorrowers.toString()} accent="bg-brand-50 text-brand-700" />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,240px)_1fr]">
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
              {pieTotal === 0 ? (
                <p className="text-sm text-slate-500">No principal recorded for the selected day.</p>
              ) : (
                <PieChart data={todaysPieData} centerLabel={currencyFormatter.format(dailyMetrics.principal)} />
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-800">Borrower distribution</h4>
              <p className="mt-1 text-xs text-slate-500">Share of principal contributed by each borrower.</p>
              <PieLegend data={todaysPieData} total={pieTotal} />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-brand-600">Monthly overview</p>
                <h3 className="text-lg font-semibold text-slate-900">{monthlyLabel}</h3>
              </div>
              <input
                type="month"
                value={monthlySelection}
                onChange={(event) => onMonthlySelectionChange(event.target.value)}
                className="w-40"
              />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <MetricCard label="Transactions" value={monthlyMetrics.count.toString()} />
              <MetricCard label="Principal" value={currencyFormatter.format(monthlyMetrics.principal)} />
              <MetricCard label="Interest" value={currencyFormatter.format(monthlyMetrics.interest)} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Interest outlook</h3>
            <p className="mt-1 text-sm text-slate-600">
              Projected interest across today&apos;s active loans totals{' '}
              <span className="font-semibold text-slate-900">{currencyFormatter.format(dailyMetrics.interest)}</span> over
              their agreed terms.
            </p>
            <p className="mt-3 text-xs text-slate-500">The figure assumes all payments are completed for the full term.</p>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">Today&apos;s borrowers</h3>
          <p className="text-sm text-slate-600">Captured on {formatDateHuman(dailyDate)}.</p>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Principal</th>
                <th>Interest %</th>
                <th>Monthly interest</th>
                <th>Term</th>
              </tr>
            </thead>
            <tbody>
              {todaysRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                    No lending records were captured for this date.
                  </td>
                </tr>
              ) : (
                todaysRecords.map((record) => (
                  <tr key={record.id} className="odd:bg-white even:bg-slate-50">
                    <td className="font-medium text-slate-800">{record.customerName}</td>
                    <td>{currencyFormatter.format(record.principal)}</td>
                    <td>{percentFormatter.format(record.interestRate)}</td>
                    <td>{currencyFormatter.format(record.monthlyInterest)}</td>
                    <td>{record.term} mo</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface PieChartProps {
  data: PieSlice[];
  size?: number;
  centerLabel?: string;
}

function PieChart({ data, size = 220, centerLabel }: PieChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const radius = size / 2;
  const viewBox = `0 0 ${size} ${size}`;
  let accumulated = 0;

  if (total === 0) {
    return <p className="text-sm text-slate-500">No data</p>;
  }

  return (
    <svg width={size} height={size} viewBox={viewBox} role="img" aria-label="Pie chart of principal distribution">
      {data.map((slice) => {
        const startAngle = (accumulated / total) * 2 * Math.PI;
        accumulated += slice.value;
        const endAngle = (accumulated / total) * 2 * Math.PI;
        const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
        const x1 = radius + radius * Math.cos(startAngle);
        const y1 = radius + radius * Math.sin(startAngle);
        const x2 = radius + radius * Math.cos(endAngle);
        const y2 = radius + radius * Math.sin(endAngle);
        const pathData = [
          `M ${radius} ${radius}`,
          `L ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
          'Z',
        ].join(' ');

        return <path key={`${slice.label}-${slice.value}`} d={pathData} fill={slice.color} stroke="white" strokeWidth="1" />;
      })}
      <circle cx={radius} cy={radius} r={radius * 0.5} fill="white" />
      {centerLabel && (
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="text-sm font-semibold fill-slate-700">
          {centerLabel}
        </text>
      )}
    </svg>
  );
}

interface PieLegendProps {
  data: PieSlice[];
  total: number;
}

function PieLegend({ data, total }: PieLegendProps) {
  if (total === 0 || data.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">No borrowers recorded for this day.</p>;
  }

  return (
    <ul className="mt-4 space-y-3 text-sm text-slate-700">
      {data.map((slice) => {
        const percentage = total === 0 ? 0 : (slice.value / total) * 100;
        return (
          <li key={slice.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
              <span className="font-medium">{slice.label}</span>
            </div>
            <span className="text-xs text-slate-500">{percentage.toFixed(1)}%</span>
          </li>
        );
      })}
    </ul>
  );
}
