'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { JobPostingListItem } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PAGE_SIZE = 12;
const BRAND_BLUE = '#00529b';

function toSearchText(job: JobPostingListItem) {
  return [
    job.job_title,
    job.job_location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

type LocationBucket = 'UAE' | 'KSA' | 'Remote' | 'Not specified';

const UAE_EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'] as const;

function normalizeLocationBucket(jobLocation?: string | null): LocationBucket {
  const raw = String(jobLocation || '').trim().toLowerCase();
  if (!raw) return 'Not specified';
  const has = (...keys: string[]) => keys.some((k) => raw.includes(k));
  if (has('remote', 'work from home', 'wfh', 'anywhere')) return 'Remote';
  if (has('ksa', 'saudi', 'riyadh', 'jeddah', 'dammam', 'khobar', 'al khobar')) return 'KSA';
  if (has('uae', 'dubai', 'abu dhabi', 'abudhabi', 'sharjah', 'ajman', 'ras al khaimah', 'rak', 'fujairah', 'al ain')) return 'UAE';
  return 'Not specified';
}

function normalizeUaeEmirate(jobLocation?: string | null): (typeof UAE_EMIRATES)[number] | null {
  const raw = String(jobLocation || '').trim().toLowerCase();
  if (!raw) return null;
  const has = (...keys: string[]) => keys.some((k) => raw.includes(k));
  if (has('dubai', 'dxb')) return 'Dubai';
  if (has('abu dhabi', 'abudhabi', 'auh', 'al ain')) return 'Abu Dhabi';
  if (has('sharjah')) return 'Sharjah';
  if (has('ajman')) return 'Ajman';
  if (has('ras al khaimah', 'rasalkhaimah', 'rak')) return 'Ras Al Khaimah';
  if (has('fujairah')) return 'Fujairah';
  if (has('umm al quwain', 'ummalqaiwain', 'uaq')) return 'Umm Al Quwain';
  return null;
}

function normalizeKsaCity(jobLocation?: string | null): string | null {
  const raw = String(jobLocation || '').trim();
  if (!raw) return null;
  const s = raw.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => s.includes(k));
  if (has('riyadh')) return 'Riyadh';
  if (has('jeddah')) return 'Jeddah';
  if (has('dammam')) return 'Dammam';
  if (has('khobar', 'al khobar')) return 'Al Khobar';
  if (has('mecca', 'makkah')) return 'Makkah';
  if (has('medina', 'madinah')) return 'Madinah';
  if (has('jubail')) return 'Jubail';
  if (has('yanbu')) return 'Yanbu';
  if (has('taif')) return 'Taif';
  if (has('tabuk')) return 'Tabuk';
  if (has('abha')) return 'Abha';
  if (has('najran')) return 'Najran';
  if (has('jizan', 'gizan')) return 'Jizan';
  if (has('hail')) return 'Hail';
  if (has('buraidah', 'buraydah')) return 'Buraidah';
  // Fallback: extract first comma/pipe separated token as "city" if present
  const token = raw.split(/[|,]/)[0]?.trim();
  return token && token.length <= 40 ? token : null;
}

function toSkillMatchText(job: JobPostingListItem) {
  return [
    job.job_title,
    job.job_summary,
    job.qualifications,
    job.key_responsibilities,
    job.job_location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normSkill(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function PublicJobOpeningsPage() {
  const [jobs, setJobs] = useState<JobPostingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [skillDraft, setSkillDraft] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [locationBucket, setLocationBucket] = useState<LocationBucket | 'All'>('All');
  const [uaeEmirates, setUaeEmirates] = useState<string[]>([]);
  const [ksaCities, setKsaCities] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const rows = await api.getRecentJobPostings(50);
        if (!mounted) return;
        setJobs(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load job openings');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return jobs
      .filter((job) => (locationBucket === 'All' ? true : normalizeLocationBucket(job.job_location) === locationBucket))
      .filter((job) => {
        if (locationBucket === 'UAE' && uaeEmirates.length > 0) {
          const emirate = normalizeUaeEmirate(job.job_location);
          return emirate ? uaeEmirates.includes(emirate) : false;
        }
        if (locationBucket === 'KSA' && ksaCities.length > 0) {
          const city = normalizeKsaCity(job.job_location);
          return city ? ksaCities.includes(city) : false;
        }
        return true;
      })
      .filter((job) => {
        if (skills.length === 0) return true;
        const hay = toSkillMatchText(job);
        // match-all skills for more accurate filtering
        return skills.every((s) => hay.includes(normSkill(s)));
      })
      .filter((job) => (!kw ? true : toSearchText(job).includes(kw)));
  }, [jobs, keyword, locationBucket, skills, uaeEmirates, ksaCities]);

  const availableKsaCities = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) {
      if (normalizeLocationBucket(j.job_location) !== 'KSA') continue;
      const city = normalizeKsaCity(j.job_location);
      if (city) set.add(city);
    }
    // Prefer common cities first, then whatever else exists in the data
    const preferred = [
      'Riyadh', 'Jeddah', 'Dammam', 'Al Khobar', 'Makkah', 'Madinah', 'Jubail', 'Yanbu', 'Taif', 'Tabuk', 'Abha', 'Najran', 'Jizan', 'Hail', 'Buraidah',
    ];
    const rest = Array.from(set).filter((x) => !preferred.includes(x)).sort((a, b) => a.localeCompare(b));
    return [...preferred.filter((x) => set.has(x)), ...rest];
  }, [jobs]);

  const maxPageIndex = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const pageJobs = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageIndex]);

  useEffect(() => {
    // If the search reduces the result set, clamp page index.
    if (pageIndex > maxPageIndex) setPageIndex(maxPageIndex);
  }, [pageIndex, maxPageIndex]);

  const openJob = (job: JobPostingListItem) => {
    const token = job.public_token;
    if (!token || token === 'unknown') return;
    window.location.href = `/careers/jobs/${token}`;
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* Hero */}
        <div className="mb-8 rounded-3xl border border-gray-200/70 bg-white/80 backdrop-blur shadow-[0_10px_30px_-18px_rgba(2,6,23,0.25)] overflow-hidden">
          <div className="px-5 py-6 sm:px-8 sm:py-8 relative">
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: `radial-gradient(1200px 400px at 20% -10%, ${BRAND_BLUE} 0%, transparent 60%), radial-gradient(900px 340px at 90% 0%, #0ea5e9 0%, transparent 55%)`,
              }}
            />
            <div className="relative flex flex-col gap-5 items-center text-center">
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <div className="flex items-center justify-center gap-3">
                  <img
                    src="/alphadatalogo.svg"
                    alt="Alpha Data Recruitment"
                    className="h-10 sm:h-12 w-auto object-contain"
                  />
                </div>
              </div>

              <div className="max-w-3xl">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                  Our Latest Openings
                </h1>
                <div className="mt-1.5 text-sm sm:text-base font-semibold tracking-wide uppercase" style={{ color: `${BRAND_BLUE}CC` }}>
                  AI Powered Recruitment Platform
                </div>
              </div>
            </div>
          </div>
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${BRAND_BLUE}, #0ea5e9, #22c55e)` }} />
        </div>

        {error ? (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="mb-6 flex flex-col gap-3">
          <div className="relative w-full sm:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPageIndex(0);
              }}
              placeholder="Search by title or location…"
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00529b]/15 focus:border-[#00529b] shadow-sm"
            />
            {keyword ? (
              <button
                type="button"
                onClick={() => { setKeyword(''); setPageIndex(0); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-[12px] font-semibold text-gray-600">Skills</label>
              <div className="flex flex-wrap items-center gap-2">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00529b]/25 bg-[#00529b]/5 text-sm font-semibold text-gray-900"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => { setSkills((prev) => prev.filter((x) => x !== s)); setPageIndex(0); }}
                      className="text-gray-500 hover:text-gray-800"
                      aria-label={`Remove skill ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const v = normSkill(skillDraft);
                    if (!v) return;
                    setSkills((prev) => (prev.some((x) => normSkill(x) === v) ? prev : [...prev, skillDraft.trim()]));
                    setSkillDraft('');
                    setPageIndex(0);
                  }}
                  placeholder="Type a skill and press Enter…"
                  className="h-10 min-w-[240px] px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00529b]/15 focus:border-[#00529b]"
                />
                {skills.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => { setSkills([]); setSkillDraft(''); setPageIndex(0); }}
                    className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Clear skills
                  </button>
                ) : null}
              </div>

              <label className="text-[12px] font-semibold text-gray-600 ml-0 sm:ml-2">Location</label>
              <select
                value={locationBucket}
                onChange={(e) => {
                  const v = e.target.value as any;
                  setLocationBucket(v);
                  // reset sub-filters when switching bucket
                  setUaeEmirates([]);
                  setKsaCities([]);
                  setPageIndex(0);
                }}
                className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00529b]/15 focus:border-[#00529b]"
              >
                <option value="All">All</option>
                <option value="UAE">UAE</option>
                <option value="KSA">KSA</option>
                <option value="Remote">Remote</option>
                <option value="Not specified">Not specified</option>
              </select>

              {locationBucket === 'UAE' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-gray-600">Emirates</span>
                  <div className="flex flex-wrap gap-2">
                    {UAE_EMIRATES.map((em) => {
                      const checked = uaeEmirates.includes(em);
                      return (
                        <label
                          key={em}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer select-none ${
                            checked ? 'border-[#00529b]/40 bg-[#00529b]/5 text-gray-900' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setUaeEmirates((prev) => {
                                const next = new Set(prev);
                                if (on) next.add(em);
                                else next.delete(em);
                                return Array.from(next);
                              });
                              setPageIndex(0);
                            }}
                            className="accent-[#00529b]"
                          />
                          <span className="max-w-[200px] truncate">{em}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {locationBucket === 'KSA' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-gray-600">Cities</span>
                  <div className="flex flex-wrap gap-2">
                    {availableKsaCities.length === 0 ? (
                      <span className="text-sm text-gray-500">No KSA cities found in jobs</span>
                    ) : availableKsaCities.map((city) => {
                      const checked = ksaCities.includes(city);
                      return (
                        <label
                          key={city}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer select-none ${
                            checked ? 'border-[#00529b]/40 bg-[#00529b]/5 text-gray-900' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setKsaCities((prev) => {
                                const next = new Set(prev);
                                if (on) next.add(city);
                                else next.delete(city);
                                return Array.from(next);
                              });
                              setPageIndex(0);
                            }}
                            className="accent-[#00529b]"
                          />
                          <span className="max-w-[220px] truncate">{city}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {!loading ? (
              <div className="text-xs sm:text-sm text-gray-500 sm:ml-auto">
                Showing <span className="font-semibold text-gray-700">{pageJobs.length}</span> of{' '}
                <span className="font-semibold text-gray-700">{filtered.length}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Cards */}
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[190px] rounded-2xl border border-gray-200 bg-white animate-pulse" />
              ))}
            </div>
          ) : pageJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 px-6 py-10 text-center">
              <div className="text-sm font-semibold text-gray-900">No jobs found</div>
              <div className="mt-1 text-sm text-gray-600">Try a different keyword.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pageJobs.map((job) => {
                const tokenOk = job.public_token && job.public_token !== 'unknown';
                return (
                  <div
                    key={job.job_id}
                    className="group cursor-pointer"
                    onClick={() => tokenOk && openJob(job)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (!tokenOk) return;
                      if (e.key === 'Enter' || e.key === ' ') openJob(job);
                    }}
                  >
                    <div className="rounded-2xl border border-gray-200 bg-white shadow-[0_6px_18px_-14px_rgba(2,6,23,0.25)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_40px_-22px_rgba(2,6,23,0.35)] overflow-hidden">
                      <div className="h-1" style={{ background: `linear-gradient(90deg, ${BRAND_BLUE}, #0ea5e9)` }} />
                      <div className="p-5">
                        <div className="min-h-[44px]">
                          <div className="text-[15px] sm:text-[16px] font-semibold break-words text-gray-900 group-hover:underline decoration-2 underline-offset-4" style={{ textDecorationColor: `${BRAND_BLUE}55` }}>
                            {job.job_title || 'Position Available'}
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-gray-600 inline-flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" style={{ color: `${BRAND_BLUE}80` }} />
                          <span className="truncate">{job.job_location || '—'}</span>
                        </div>

                        <div className="mt-4">
                          <a
                            href={tokenOk ? `/careers/jobs/${job.public_token}` : undefined}
                            onClick={(e) => {
                              if (!tokenOk) e.preventDefault();
                              e.stopPropagation();
                            }}
                            className={
                              tokenOk
                                ? 'inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-[#00529b]'
                                : 'inline-flex items-center gap-2 text-sm font-semibold text-gray-400 cursor-not-allowed'
                            }
                          >
                            <span>More Details</span>
                            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 ? (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white"
              disabled={pageIndex <= 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <div className="text-sm text-gray-600 px-2">
              Page {pageIndex + 1} of {maxPageIndex + 1}
            </div>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white"
              disabled={pageIndex >= maxPageIndex}
              onClick={() => setPageIndex((p) => Math.min(maxPageIndex, p + 1))}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : null}

      </div>
    </div>
  );
}

