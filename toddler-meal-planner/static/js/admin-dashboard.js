/**
 * Admin dashboard — loads /api/admin/stats and renders overview tables.
 */

function adminEsc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function adminFmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return adminEsc(iso.slice(0, 10));
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function adminStatCard(value, label, icon) {
    return `
        <div class="stat-card">
            <div class="stat-icon primary">${icon || '📊'}</div>
            <div class="stat-content">
                <h3>${adminEsc(value)}</h3>
                <p>${adminEsc(label)}</p>
            </div>
        </div>
    `;
}

function renderAdminOverview(overview) {
    const el = document.getElementById('admin-overview-stats');
    if (!el) return;
    el.innerHTML = [
        adminStatCard(overview.users_total, 'Registered users', '👤'),
        adminStatCard(overview.toddlers_total, 'Toddler profiles', '👶'),
        adminStatCard(overview.toddlers_registered, 'Registered toddlers', '🏡'),
        adminStatCard(overview.toddlers_guest, 'Guest toddlers', '👻'),
        adminStatCard(overview.meal_logs_total, 'Meals logged (all time)', '🍽️'),
        adminStatCard(overview.premium_users, 'Premium users', '👑'),
    ].join('');

    const eng = document.getElementById('admin-engagement-stats');
    if (eng) {
        eng.innerHTML = [
            adminStatCard(overview.meal_logs_7d, 'Meals logged (7d)', '📅'),
            adminStatCard(overview.active_toddlers_7d, 'Active toddlers (7d)', '🔥'),
            adminStatCard(overview.users_logged_last_7d, 'Parents logging (7d)', '✅'),
            adminStatCard(`${overview.pct_users_with_logs}%`, 'Users who ever logged', '📈'),
            adminStatCard(`${overview.activation_rate_pct}%`, 'Activated in 7d of signup', '🚀'),
            adminStatCard(overview.weekly_plans, 'Weekly plans saved', '📋'),
            adminStatCard(overview.photo_logs, 'Meals with photos', '📷'),
            adminStatCard(overview.food_preferences, 'Food preference rows', '❤️'),
        ].join('');
    }
}

function renderAdminDailyChart(daily) {
    const el = document.getElementById('admin-daily-chart');
    if (!el) return;
    const max = Math.max(1, ...daily.map((d) => d.count));
    el.innerHTML = daily.map((d) => {
        const h = Math.max(4, Math.round((d.count / max) * 100));
        const label = d.date.slice(5); // MM-DD
        return `
            <div class="admin-bar-col" title="${adminEsc(d.date)}: ${d.count}">
                <span class="admin-bar-value">${d.count}</span>
                <div class="admin-bar" style="height:${h}px"></div>
                <span class="admin-bar-label">${adminEsc(label)}</span>
            </div>
        `;
    }).join('');
}

function renderAdminUsers(users) {
    const tbody = document.querySelector('#admin-users-table tbody');
    const countEl = document.getElementById('admin-user-count');
    if (countEl) countEl.textContent = `${users.length} shown`;
    if (!tbody) return;

    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="admin-muted">No registered users yet.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map((u) => {
        const hasKids = (u.toddlers || []).length > 0;
        const planBadge = u.is_premium
            ? `<span class="admin-badge premium">${adminEsc(u.subscription_tier)}</span>`
            : `<span class="admin-badge">${adminEsc(u.subscription_tier || 'free')}</span>`;
        const inactive = u.is_active === false
            ? ' <span class="admin-badge inactive">inactive</span>'
            : '';
        const expand = hasKids
            ? `<button type="button" class="admin-expand-btn" data-user="${u.id}" aria-label="Show toddlers">▸</button>`
            : '';

        const kidRows = (u.toddlers || []).map((t) => `
            <tr class="admin-toddler-row" data-parent="${u.id}" style="display:none;">
                <td></td>
                <td colspan="2">
                    <strong>${adminEsc(t.name)}</strong>
                    <span class="admin-muted"> · ${t.age_months} mo · ${adminEsc(t.dietary_preference || '—')}</span>
                </td>
                <td class="admin-muted">created ${adminFmtDate(t.created_at)}</td>
                <td>1 profile</td>
                <td><strong>${t.days_logged}</strong></td>
                <td>${t.log_count}</td>
                <td>${adminFmtDate(t.last_log)}</td>
                <td>${t.active_last_7d ? '🟢 7d' : (t.active_last_30d ? '🟡 30d' : '⚪ idle')}</td>
            </tr>
        `).join('');

        return `
            <tr data-user-row="${u.id}">
                <td>${expand}</td>
                <td class="admin-user-cell">
                    <strong>${adminEsc(u.name || '—')}${inactive}</strong>
                    <span>${adminEsc(u.email)}</span>
                </td>
                <td>${adminFmtDate(u.created_at)}</td>
                <td>${adminFmtDate(u.last_login)}</td>
                <td>${u.toddler_count}</td>
                <td><strong>${u.days_logged}</strong></td>
                <td>${u.log_count}</td>
                <td>${adminFmtDate(u.last_meal_log)}</td>
                <td>${planBadge}</td>
            </tr>
            ${kidRows}
        `;
    }).join('');

    tbody.querySelectorAll('.admin-expand-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-user');
            const rows = tbody.querySelectorAll(`.admin-toddler-row[data-parent="${id}"]`);
            const open = btn.textContent.trim() === '▾';
            btn.textContent = open ? '▸' : '▾';
            rows.forEach((r) => {
                r.style.display = open ? 'none' : 'table-row';
            });
        });
    });
}

function renderAdminGuests(guests) {
    const tbody = document.querySelector('#admin-guests-table tbody');
    const countEl = document.getElementById('admin-guest-count');
    if (countEl) countEl.textContent = `${guests.length} shown`;
    if (!tbody) return;

    if (!guests.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="admin-muted">No guest toddler profiles.</td></tr>';
        return;
    }

    tbody.innerHTML = guests.map((t) => `
        <tr>
            <td><strong>${adminEsc(t.name)}</strong></td>
            <td>${t.age_months} mo</td>
            <td>${adminFmtDate(t.created_at)}</td>
            <td><strong>${t.days_logged}</strong></td>
            <td>${t.log_count}</td>
            <td>${adminFmtDate(t.last_log)}</td>
        </tr>
    `).join('');
}

function renderAdminDistributions(dist) {
    const el = document.getElementById('admin-distributions');
    if (!el || !dist) return;

    const blocks = [
        ['Dietary preference', dist.dietary_preference],
        ['Age buckets', dist.age_bucket],
        ['Meal reactions', dist.reactions],
        ['Meal types logged', dist.meal_types],
    ];

    el.innerHTML = blocks.map(([title, data]) => {
        const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
        const list = entries.length
            ? entries.map(([k, v]) => `<li><span>${adminEsc(k)}</span><strong>${v}</strong></li>`).join('')
            : '<li class="admin-muted">No data</li>';
        return `
            <div class="card">
                <div class="card-header"><h2>${adminEsc(title)}</h2></div>
                <div class="card-body"><ul class="admin-dist-list">${list}</ul></div>
            </div>
        `;
    }).join('');
}

async function loadAdminDashboard() {
    const err = document.getElementById('admin-error');
    if (err) {
        err.style.display = 'none';
        err.textContent = '';
    }
    try {
        const res = await fetch('/api/admin/stats', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Failed to load stats (${res.status})`);
        }
        const data = await res.json();
        renderAdminOverview(data.overview || {});
        renderAdminDailyChart(data.daily_meal_volume || []);
        renderAdminUsers(data.users || []);
        renderAdminGuests(data.guest_toddlers || []);
        renderAdminDistributions(data.distributions || {});
    } catch (e) {
        console.error(e);
        if (err) {
            err.style.display = 'block';
            err.innerHTML = `<div class="alert-content"><p>${adminEsc(e.message)}</p></div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'admin' || document.getElementById('admin-overview-stats')) {
        loadAdminDashboard();
    }
});
