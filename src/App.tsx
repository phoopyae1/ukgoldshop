import { Form, Formik } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import * as Yup from 'yup';
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
    .typeError('Select an interest rate')
    .min(0.005, 'Interest rate must be positive')
    .required('Interest rate is required'),
  term: Yup.number().typeError('Term must be a number').min(1, 'Term must be at least 1 month').required('Loan term is required'),
  date: Yup.string().required('Transaction date is required'),
});

const loginValidationSchema = Yup.object({
  role: Yup.mixed<Role>().oneOf(['admin', 'data-admin']).required(),
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
  const [goldItems, setGoldItems] = useState<GoldItem[]>(() => safeReadStorage(GOLD_STORAGE_KEY, []));
  const [pawnRecords, setPawnRecords] = useState<PawnRecord[]>(() => safeReadStorage(PAWN_STORAGE_KEY, []));
  const [loginError, setLoginError] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState<string>(() => getCurrentDateISO());
  const [monthlySelection, setMonthlySelection] = useState<string>(() => getCurrentMonthISO());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(GOLD_STORAGE_KEY, JSON.stringify(goldItems));
  }, [goldItems]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PAWN_STORAGE_KEY, JSON.stringify(pawnRecords));
  }, [pawnRecords]);

  const dailyMetrics = useMemo(() => calculateDailyMetrics(pawnRecords, dailyDate), [pawnRecords, dailyDate]);
  const monthlyMetrics = useMemo(
    () => calculateMonthlyMetrics(pawnRecords, monthlySelection),
    [pawnRecords, monthlySelection],
  );

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

  const handleGoldSubmit = (values: GoldFormValues, resetForm: () => void) => {
    const newItem: GoldItem = {
      id: crypto.randomUUID(),
      name: values.name.trim(),
      price: Number(values.price),
      image: values.image,
      uploadedAt: new Date().toISOString(),
    };
    setGoldItems((prev) => [newItem, ...prev]);
    resetForm();
  };

  const handlePawnSubmit = (values: PawnFormValues, resetForm: () => void) => {
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

    setPawnRecords((prev) => [newRecord, ...prev]);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-brand-600">UK Gold Shop</p>
            <h1 className="text-2xl font-semibold text-slate-900">Admin & Pawn Operations Portal</h1>
          </div>
          {activeRole && (
            <div className="flex items-center gap-4">
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
                {activeRole === 'admin' ? 'Shop Admin' : 'Pawn Data Admin'}
              </span>
              <button type="button" onClick={handleLogout} className="bg-slate-900 hover:bg-slate-800">
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {!activeRole ? (
        <div className="mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-6xl items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">Sign in to continue</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose your role and use the default credentials to access the dashboard.
            </p>
            <Formik<LoginFormValues>
              initialValues={{ role: 'admin', username: '', password: '' }}
              validationSchema={loginValidationSchema}
              onSubmit={handleLogin}
            >
              {({ values, handleChange, errors, touched }) => (
                <Form className="mt-6 space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="role">Role</label>
                    <select id="role" name="role" value={values.role} onChange={handleChange}>
                      <option value="admin">Shop Admin</option>
                      <option value="data-admin">Pawn Data Admin</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="username">Username</label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={values.username}
                      onChange={handleChange}
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
                      value={values.password}
                      onChange={handleChange}
                      aria-invalid={Boolean(touched.password && errors.password)}
                    />
                    {touched.password && errors.password && (
                      <p className="text-sm text-rose-600">{errors.password}</p>
                    )}
                  </div>
                  {loginError && <p className="text-sm font-medium text-rose-600">{loginError}</p>}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div>
                      <p>Shop Admin · admin / admin123</p>
                      <p>Pawn Data · dataman / data123</p>
                    </div>
                  </div>
                  <button type="submit" className="w-full">Sign in</button>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      ) : (
        <main className="mx-auto w-full max-w-6xl space-y-10 px-4 pb-16 pt-10">
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
                  onSubmit={(values, helpers) => {
                    handleGoldSubmit(values, () => helpers.resetForm());
                    helpers.setSubmitting(false);
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
                          <label htmlFor="price">Price (GBP)</label>
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
          ) : (
            <section className="space-y-10">
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Capture pawn transaction</h2>
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
                    onSubmit={(values, helpers) => {
                      handlePawnSubmit(values, () =>
                        helpers.resetForm({
                          values: {
                            customerName: '',
                            principal: '',
                            interestRate: interestOptions[2],
                            term: 6,
                            date: getCurrentDateISO(),
                          },
                        }),
                      );
                      helpers.setSubmitting(false);
                    }}
                  >
                    {({ values, setFieldValue, errors, touched }) => {
                      const principal = Number(values.principal) || 0;
                      const interestRate = Number(values.interestRate) || 0;
                      const term = Number(values.term) || 0;
                      const monthlyInterest = principal * interestRate;
                      const totalPayable = principal + monthlyInterest * term;

                      return (
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
                              <label htmlFor="principal">Loan amount (GBP)</label>
                              <input
                                id="principal"
                                name="principal"
                                type="number"
                                min="0"
                                value={values.principal}
                                onChange={(event) => setFieldValue('principal', event.target.value ? Number(event.target.value) : '')}
                                aria-invalid={Boolean(touched.principal && errors.principal)}
                              />
                              {touched.principal && errors.principal && (
                                <p className="text-sm text-rose-600">{errors.principal}</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <label htmlFor="interestRate">Interest % (per month)</label>
                              <select
                                id="interestRate"
                                name="interestRate"
                                value={values.interestRate}
                                onChange={(event) => setFieldValue('interestRate', Number(event.target.value))}
                              >
                                <option value="" disabled>
                                  Select rate
                                </option>
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
                                onChange={(event) => setFieldValue('term', event.target.value ? Number(event.target.value) : '')}
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
                          <div className="grid gap-4 rounded-xl border border-brand-200 bg-brand-50/70 p-4 sm:grid-cols-2">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-brand-600">Monthly interest</p>
                              <p className="text-lg font-semibold text-brand-900">
                                {currencyFormatter.format(Number.isFinite(monthlyInterest) ? monthlyInterest : 0)}
                              </p>
                              <p className="text-xs text-brand-700">
                                {percentFormatter.format(interestRate || 0)} of {currencyFormatter.format(principal || 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-brand-600">Total payable</p>
                              <p className="text-lg font-semibold text-brand-900">
                                {currencyFormatter.format(Number.isFinite(totalPayable) ? totalPayable : 0)}
                              </p>
                              <p className="text-xs text-brand-700">Includes all interest across {term || 0} months</p>
                            </div>
                          </div>
                          <button type="submit" className="w-full sm:w-auto">
                            Save pawn record
                          </button>
                        </Form>
                      );
                    }}
                  </Formik>
                </div>
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-brand-600">Today&apos;s focus</p>
                        <h3 className="text-lg font-semibold text-slate-900">Daily performance</h3>
                      </div>
                      <input
                        type="date"
                        value={dailyDate}
                        onChange={(event) => setDailyDate(event.target.value)}
                        className="w-40"
                      />
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{formatDateHuman(dailyDate)}</p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <MetricCard label="Transactions" value={dailyMetrics.count.toString()} accent="bg-brand-100 text-brand-700" />
                      <MetricCard
                        label="Principal"
                        value={currencyFormatter.format(dailyMetrics.principal)}
                        accent="bg-brand-100 text-brand-700"
                      />
                      <MetricCard
                        label="Interest"
                        value={currencyFormatter.format(dailyMetrics.interest)}
                        accent="bg-brand-100 text-brand-700"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-brand-600">Monthly overview</p>
                        <h3 className="text-lg font-semibold text-slate-900">{monthlyLabel}</h3>
                      </div>
                      <input
                        type="month"
                        value={monthlySelection}
                        onChange={(event) => setMonthlySelection(event.target.value)}
                        className="w-40"
                      />
                    </div>
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <MetricCard label="Transactions" value={monthlyMetrics.count.toString()} />
                      <MetricCard label="Principal" value={currencyFormatter.format(monthlyMetrics.principal)} />
                      <MetricCard label="Interest" value={currencyFormatter.format(monthlyMetrics.interest)} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="table-card">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <h3 className="text-base font-semibold text-slate-800">Pawn transactions</h3>
                  <p className="text-sm text-slate-600">Full audit trail of captured pledges.</p>
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
