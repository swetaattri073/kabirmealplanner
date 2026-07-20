/**
 * Toddler Meal Planner - Frontend JavaScript
 */

// API Base URL
const API_BASE = '/api';

// ==================== Utility Functions ====================

async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const result = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            throw new Error(result.error || 'API request failed');
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        showToast(error.message || 'Something went wrong', 'error');
        throw error;
    }
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

/** Local calendar YYYY-MM-DD (avoid UTC skew from toISOString). */
function localDateISO(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local Date at noon (stable across DST). */
function parseLocalDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
}

function getMealTypeIcon(mealType) {
    const icons = {
        'breakfast': '🌅',
        'mid_morning_snack': '🍎',
        'lunch': '🍱',
        'evening_snack': '🥛',
        'dinner': '🌙'
    };
    return icons[mealType] || '🍽️';
}

function formatMealType(mealType) {
    return mealType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ==================== Dashboard Functions ====================

async function loadDashboard(toddlerId) {
    try {
        const data = await apiCall(`/dashboard/${toddlerId}`);
        renderDashboard(data);
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

function renderDashboard(data) {
    // Render nutrition status
    renderNutritionStatus(data.nutrition, data.toddler?.id);
    
    // Render meal schedule
    renderMealSchedule(data);
    
    // Render alerts
    renderAlerts(data.alerts);
}

function renderNutritionStatus(nutrition, toddlerId) {
    const container = document.getElementById('nutrition-grid');
    if (!container) return;
    
    const priorityNutrients = ['calories', 'protein_g', 'iron_mg', 'calcium_mg', 'vitamin_a_mcg', 'vitamin_c_mg'];
    const tid = toddlerId || document.body.dataset.toddlerId;
    
    let html = '';
    priorityNutrients.forEach(key => {
        const nutrient = nutrition[key];
        if (!nutrient) return;
        
        const percentage = Math.min(nutrient.percentage, 150);
        const statusClass = nutrient.status;
        const info = nutrient.info || {};
        
        html += `
            <button type="button" class="nutrient-card nutrient-card-btn"
                    onclick="openNutritionBreakdown(${tid ? Number(tid) : 'null'}, '${key}')"
                    aria-label="View ${info.name || key} breakdown">
                <div class="nutrient-header">
                    <span class="nutrient-icon">${info.icon || '📊'}</span>
                    <span class="nutrient-name">${info.name || key}</span>
                </div>
                <div class="nutrient-bar">
                    <div class="nutrient-fill ${statusClass}" style="width: ${percentage}%"></div>
                </div>
                <div class="nutrient-values">
                    <span>${nutrient.actual} ${info.unit || ''}</span>
                    <span>${nutrient.percentage}% of RDA</span>
                </div>
            </button>
        `;
    });
    
    container.innerHTML = html || '<p class="nutrition-hint">No nutrition data yet — log a meal to see totals.</p>';
}

function formatMealTypeLabel(mealType) {
    return String(mealType || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ensureNutritionModal() {
    let modal = document.getElementById('nutrition-breakdown-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'nutrition-breakdown-modal';
    modal.className = 'nutrition-modal';
    modal.hidden = true;
    modal.innerHTML = `
        <div class="nutrition-modal-backdrop" onclick="closeNutritionBreakdown()"></div>
        <div class="nutrition-modal-panel" role="dialog" aria-modal="true" aria-labelledby="nutrition-modal-title">
            <div class="nutrition-modal-header">
                <div>
                    <h2 id="nutrition-modal-title">Nutrient details</h2>
                    <p class="nutrition-modal-sub" id="nutrition-modal-sub"></p>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeNutritionBreakdown()" aria-label="Close">Close</button>
            </div>
            <div class="nutrition-modal-filters" id="nutrition-modal-filters"></div>
            <div class="nutrition-modal-body" id="nutrition-modal-body"></div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function closeNutritionBreakdown() {
    const modal = document.getElementById('nutrition-breakdown-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('nutrition-modal-open');
}

async function openNutritionBreakdown(toddlerId, focusNutrient) {
    const tid = toddlerId || document.body.dataset.toddlerId;
    if (!tid) return;
    const modal = ensureNutritionModal();
    const body = document.getElementById('nutrition-modal-body');
    const sub = document.getElementById('nutrition-modal-sub');
    const filters = document.getElementById('nutrition-modal-filters');
    modal.hidden = false;
    document.body.classList.add('nutrition-modal-open');
    body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    filters.innerHTML = '';
    sub.textContent = 'Loading…';

    try {
        const data = await apiCall(`/nutrition/breakdown/${tid}`);
        window._nutritionBreakdownCache = data;
        renderNutritionBreakdownModal(data, focusNutrient || null);
    } catch (err) {
        console.error(err);
        body.innerHTML = `<p class="nutrition-hint">Could not load nutrient details.</p>`;
        sub.textContent = '';
    }
}

function renderNutritionBreakdownModal(data, focusNutrient) {
    const body = document.getElementById('nutrition-modal-body');
    const sub = document.getElementById('nutrition-modal-sub');
    const filters = document.getElementById('nutrition-modal-filters');
    if (!body) return;

    const info = data.nutrient_info || {};
    const priority = ['calories', 'protein_g', 'iron_mg', 'calcium_mg', 'vitamin_a_mcg', 'vitamin_c_mg', 'fat_g', 'fiber_g', 'zinc_mg', 'vitamin_d_mcg'];
    const keys = priority.filter((k) => info[k] || (data.nutrition && data.nutrition[k]));
    const active = focusNutrient && keys.includes(focusNutrient) ? focusNutrient : null;

    sub.textContent = `${data.toddler_name || ''} · ${data.date || 'today'} · ${data.item_count || 0} item(s) logged`;

    filters.innerHTML = `
        <button type="button" class="nutrition-filter-chip ${!active ? 'active' : ''}"
                onclick="renderNutritionBreakdownModal(window._nutritionBreakdownCache, null)">All meals</button>
        ${keys.map((k) => {
            const n = info[k] || {};
            return `<button type="button" class="nutrition-filter-chip ${active === k ? 'active' : ''}"
                onclick="renderNutritionBreakdownModal(window._nutritionBreakdownCache, '${k}')">${n.icon || ''} ${n.name || k}</button>`;
        }).join('')}
    `;

    if (!data.meals || !data.meals.length) {
        body.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🍽️</div>
                <h3>No meals logged today</h3>
                <p>Log a meal to see the nutrient calculation per item.</p>
            </div>`;
        return;
    }

    let html = '';
    if (active) {
        const meta = info[active] || {};
        const total = data.nutrition?.[active];
        html += `
            <div class="nutrition-focus-summary">
                <strong>${meta.icon || ''} ${meta.name || active}</strong>
                <span>${total ? `${total.actual} ${meta.unit || ''} · ${total.percentage}% of RDA` : '—'}</span>
            </div>
        `;
        const contrib = [];
        (data.items || []).forEach((item) => {
            const val = item.nutrients ? (item.nutrients[active] || 0) : 0;
            contrib.push({ ...item, value: val });
        });
        contrib.sort((a, b) => b.value - a.value);
        const dayTotal = total?.actual || contrib.reduce((s, c) => s + c.value, 0) || 1;
        html += contrib.map((item) => {
            const share = dayTotal ? Math.round((item.value / dayTotal) * 100) : 0;
            return `
                <div class="nutrition-item-card">
                    <div class="nutrition-item-top">
                        <strong>${escapeHtml(item.food_name)}</strong>
                        <span>${formatMealTypeLabel(item.meal_type)}</span>
                    </div>
                    <div class="nutrition-item-values">
                        <strong>${Number(item.value || 0).toFixed(1)} ${meta.unit || ''}</strong>
                        <span>${share}% of today's ${meta.name || active}</span>
                    </div>
                    <p class="nutrition-item-formula">${escapeHtml(item.formula || item.not_counted_reason || '')}</p>
                    ${!item.counted ? `<p class="nutrition-item-warn">${escapeHtml(item.not_counted_reason || 'Not counted')}</p>` : ''}
                </div>
            `;
        }).join('');
    } else {
        html += (data.meals || []).map((meal) => {
            const kcal = meal.totals?.calories;
            return `
                <div class="nutrition-meal-block">
                    <div class="nutrition-meal-head">
                        <h3>${formatMealTypeLabel(meal.meal_type)}</h3>
                        <span>${kcal != null ? `${Math.round(kcal)} kcal` : '—'}</span>
                    </div>
                    ${(meal.items || []).map((item) => {
                        const n = item.nutrients || {};
                        return `
                            <div class="nutrition-item-card">
                                <div class="nutrition-item-top">
                                    <strong>${escapeHtml(item.food_name)}</strong>
                                    <span>${item.effective_portion_eaten_percent ?? item.portion_eaten_percent ?? 0}% eaten</span>
                                </div>
                                <div class="nutrition-item-chips">
                                    <span>${Math.round(n.calories || 0)} kcal</span>
                                    <span>${Number(n.protein_g || 0).toFixed(1)}g protein</span>
                                    <span>${Number(n.iron_mg || 0).toFixed(1)}mg iron</span>
                                    <span>${Number(n.calcium_mg || 0).toFixed(0)}mg calcium</span>
                                </div>
                                <p class="nutrition-item-formula">${escapeHtml(item.formula || item.not_counted_reason || 'Custom food — nutrients not in database')}</p>
                                ${!item.counted ? `<p class="nutrition-item-warn">${escapeHtml(item.not_counted_reason || 'Not counted in daily totals')}</p>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }).join('');
    }

    body.innerHTML = html;
}

function renderMealSchedule(data) {
    const container = document.getElementById('meal-schedule');
    if (!container) return;
    
    const allMeals = [...(data.schedule?.meals || []), ...(data.schedule?.snacks || [])];
    const todayLogs = data.today_logs || [];
    const suggestions = data.suggestions || {};
    const plannedMeals = data.today_plan?.meals || {};
    
    let html = '';
    allMeals.forEach(mealType => {
        const isEaten = data.meals_eaten?.includes(mealType);
        const log = todayLogs.find(l => l.meal_type === mealType);
        const plannedName = getPlannedMealDisplayName(plannedMeals[mealType]);
        const suggestion = suggestions[mealType]?.[0];
        let pendingLabel = 'Not planned yet';
        if (plannedName) {
            pendingLabel = plannedName;
        } else if (suggestion?.food?.name) {
            pendingLabel = `Suggested: ${suggestion.food.name}`;
        }
        
        html += `
            <div class="meal-slot ${isEaten ? 'completed' : 'pending'}">
                <div class="meal-time-icon">${getMealTypeIcon(mealType)}</div>
                <div class="meal-info">
                    <div class="meal-type">${formatMealType(mealType)}</div>
                    ${isEaten 
                    ? `<div class="meal-food">
                        ${log?.food?.name || log?.custom_food_name || 'Logged'}
                        ${log?.nutrients ? `<div class="nutrient-preview"><span>${Math.round(log.nutrients.calories || 0)} kcal</span></div>` : ''}
                       </div>`
                    : `<div class="meal-food">${pendingLabel}</div>`}
                </div>
                ${isEaten 
                    ? '<span class="meal-action done"><i class="fas fa-check"></i></span>'
                    : `<a href="/log-meal/${data.toddler.id}?meal=${mealType}" class="meal-action log-btn">Log</a>`
                }
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderAlerts(alerts) {
    const container = document.getElementById('alerts-container');
    if (!container) return;
    
    if (!alerts || alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <h3>All Good!</h3>
                <p>No nutrition concerns at the moment.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    alerts.forEach(alert => {
        html += `
            <div class="alert ${alert.severity}">
                <div class="alert-icon">
                    ${alert.severity === 'critical' ? '⚠️' : alert.severity === 'warning' ? '⚡' : 'ℹ️'}
                </div>
                <div class="alert-content">
                    <h4>${alert.icon || ''} ${alert.nutrient_name || alert.type}</h4>
                    <p>${alert.message}</p>
                    ${alert.recommended_foods?.length > 0 ? `
                        <div class="alert-foods">
                            ${alert.recommended_foods.map(f => `
                                <span class="food-chip">${f.name}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ==================== Meal Logging Functions ====================

let selectedFood = null;
let selectedReaction = null;
let portionEaten = 100;

async function loadFoods(toddlerId, ageMonths) {
    try {
        const foods = await apiCall(`/foods?age_months=${ageMonths}`);
        renderFoodList(foods);
    } catch (error) {
        console.error('Failed to load foods:', error);
    }
}

function renderFoodList(foods, filter = '') {
    const container = document.getElementById('food-list');
    if (!container) return;
    
    const filtered = filter 
        ? foods.filter(f => 
            f.name.toLowerCase().includes(filter.toLowerCase()) ||
            (f.name_hindi && f.name_hindi.toLowerCase().includes(filter.toLowerCase()))
        )
        : foods;
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 1rem;">
                <p>No foods found. Try a different search.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    filtered.forEach(food => {
        html += `
            <div class="food-item ${selectedFood?.id === food.id ? 'selected' : ''}" 
                 onclick="selectFood(${JSON.stringify(food).replace(/"/g, '&quot;')})">
                <div class="food-item-info">
                    <div class="food-item-name">${food.name}</div>
                    ${food.name_hindi ? `<div class="food-item-hindi">${food.name_hindi}</div>` : ''}
                </div>
                <span class="food-item-category">${food.category}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function selectFood(food) {
    selectedFood = food;
    
    // Update UI
    document.querySelectorAll('.food-item').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    // Show food details
    const details = document.getElementById('selected-food-details');
    if (details) {
        details.innerHTML = `
            <h4>${food.name} ${food.name_hindi ? `(${food.name_hindi})` : ''}</h4>
            <p>${food.toddler_friendly_version || ''}</p>
            ${food.preparation_tips ? `<p><strong>Tip:</strong> ${food.preparation_tips}</p>` : ''}
        `;
        details.style.display = 'block';
    }
}

function selectReaction(reaction) {
    selectedReaction = reaction;
    
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.reaction === reaction) {
            btn.classList.add('selected');
        }
    });
}

function updatePortion(value) {
    portionEaten = parseInt(value);
    const label = document.getElementById('portion-label');
    if (label) {
        label.textContent = `${portionEaten}%`;
    }
}

async function logMeal(toddlerId) {
    const mealType = document.getElementById('meal-type')?.value;
    const customFood = document.getElementById('custom-food')?.value;
    const notes = document.getElementById('notes')?.value;
    const dateInput = document.getElementById('meal-date')?.value;
    
    if (!mealType) {
        showToast('Please select a meal type', 'error');
        return;
    }
    
    if (!selectedFood && !customFood) {
        showToast('Please select a food or enter a custom food name', 'error');
        return;
    }
    
    const data = {
        toddler_id: toddlerId,
        meal_type: mealType,
        food_id: selectedFood?.id || null,
        custom_food_name: customFood || null,
        portion_eaten_percent: portionEaten,
        toddler_reaction: selectedReaction,
        notes: notes,
        date: dateInput || localDateISO()
    };
    
    try {
        await apiCall('/meal-logs', 'POST', data);
        showToast('Meal logged successfully!', 'success');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = `/dashboard/${toddlerId}`;
        }, 1000);
    } catch (error) {
        console.error('Failed to log meal:', error);
    }
}

// ==================== Adult Meal Adaptation ====================

async function adaptAdultMeal(toddlerId, addToPlan = false) {
    const adultMeal = document.getElementById('adult-meal-input')?.value;
    const mealType = document.getElementById('adult-meal-type')?.value || 'lunch';
    
    if (!adultMeal) {
        showToast('Please enter the adult meal', 'error');
        return;
    }
    
    try {
        const payload = {
            adult_meal: adultMeal,
            meal_type: mealType,
            add_to_plan: addToPlan
        };
        
        const result = await apiCall(`/adapt-meal/${toddlerId}`, 'POST', payload);
        
        renderAdaptationResults(result, toddlerId, addToPlan);
        
        if (addToPlan && result.added_to_plan) {
            showToast(`Added to today's ${mealType}! Future plans adjusted to avoid repetition.`, 'success');
        }
    } catch (error) {
        console.error('Failed to adapt meal:', error);
    }
}

function renderAdaptationResults(result, toddlerId, wasAddedToPlan = false) {
    const container = document.getElementById('adaptation-results');
    if (!container) return;
    
    let html = '';
    
    // If added to plan, show success message
    if (wasAddedToPlan && result.added_to_plan) {
        html += `
            <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(74, 222, 128, 0.05)); 
                        padding: 1.5rem; border-radius: var(--radius-md); border: 2px solid var(--success); margin-bottom: 1.5rem;">
                <h3 style="color: var(--success); margin-bottom: 0.75rem;">
                    ✅ Added to Today's ${result.added_to_plan.meal_type.charAt(0).toUpperCase() + result.added_to_plan.meal_type.slice(1)}!
                </h3>
                <p style="margin-bottom: 0.5rem;">
                    <strong>${result.added_to_plan.food_name}</strong> has been logged for ${result.added_to_plan.date}
                </p>
                ${result.added_to_plan.plans_adjusted > 0 ? `
                    <p style="font-size: 0.9rem; color: var(--text-secondary);">
                        📅 ${result.added_to_plan.plans_adjusted} future meal(s) adjusted to avoid repetition
                    </p>
                ` : ''}
                ${result.added_to_plan.tips?.length > 0 ? `
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--border-color);">
                        <p style="font-weight: 600; margin-bottom: 0.25rem;">💡 Preparation Tips:</p>
                        <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.9rem; color: var(--text-secondary);">
                            ${result.added_to_plan.tips.map(tip => `<li>${tip}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    html += `<h3 style="margin-bottom: 1rem;">🍽️ Toddler Adaptations for "${result.adult_meal}"</h3>`;
    
    if (result.matched_foods?.length > 0) {
        html += `<div class="adaptation-results" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">`;
        
        result.matched_foods.forEach((item, index) => {
            const isFirst = index === 0;
            html += `
                <div class="adaptation-card" style="background: ${isFirst && !wasAddedToPlan ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.05))' : 'var(--bg-tertiary)'}; 
                     border: ${isFirst && !wasAddedToPlan ? '2px solid var(--primary)' : '1px solid var(--border-color)'};">
                    ${isFirst && !wasAddedToPlan ? '<span style="font-size: 0.75rem; background: var(--primary); color: white; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); display: inline-block; margin-bottom: 0.5rem;">Recommended</span>' : ''}
                    <h4 style="display: flex; align-items: center; gap: 0.5rem;">
                        🍽️ ${item.original_food}
                    </h4>
                    <p style="margin: 0.5rem 0;"><strong>For ${result.toddler_name}:</strong></p>
                    <p style="color: var(--text-secondary);">${item.toddler_version}</p>
                    ${item.preparation_tips ? `<p style="font-size: 0.9rem; font-style: italic; color: var(--text-muted); margin-top: 0.5rem;">${item.preparation_tips}</p>` : ''}
                    <p style="margin-top: 0.75rem;"><strong>Serving:</strong> ~${item.serving_size}g</p>
                    ${item.spice_warning ? '<p style="color: var(--warning); font-size: 0.9rem;">⚠️ Reduce spice level significantly</p>' : ''}
                    ${!wasAddedToPlan ? `
                        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                            <button class="btn btn-primary btn-sm" onclick='addAdaptedFoodToPlan(${toddlerId}, ${item.food_id}, "${result.adult_meal.replace(/"/g, '\\"')}")'>
                                <i class="fas fa-plus"></i> Add to Plan
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick='selectAdaptedFood(${JSON.stringify(item)})'>
                                Log Manually
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    if (result.general_tips?.length > 0) {
        html += `
            <div class="adaptation-card" style="margin-top: 1.5rem; background: linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(251, 191, 36, 0.05)); border: 1px solid rgba(234, 179, 8, 0.3);">
                <h4 style="display: flex; align-items: center; gap: 0.5rem;">💡 Adaptation Tips</h4>
                <ul class="adaptation-tips" style="margin-top: 0.75rem;">
                    ${result.general_tips.map(tip => `<li>${tip}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    if (!result.matched_foods?.length && !result.general_tips?.length) {
        html += `
            <div class="empty-state" style="padding: 2rem; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🤔</div>
                <p>No specific adaptations found for this meal.</p>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">Try describing individual dishes (e.g., "dal, rice, aloo sabzi")</p>
            </div>
        `;
    }
    
    container.innerHTML = html;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function addAdaptedFoodToPlan(toddlerId, foodId, adultMeal) {
    const mealType = document.getElementById('adult-meal-type')?.value || 'lunch';
    
    try {
        const result = await apiCall(`/adapt-meal/${toddlerId}`, 'POST', {
            adult_meal: adultMeal,
            meal_type: mealType,
            add_to_plan: true,
            selected_food_id: foodId
        });
        
        renderAdaptationResults(result, toddlerId, true);
        showToast(`Added to today's ${mealType}!`, 'success');
    } catch (error) {
        console.error('Failed to add to plan:', error);
    }
}

function selectAdaptedFood(item) {
    // Pre-fill the food selection from adaptation
    selectedFood = {
        id: item.food_id,
        name: item.original_food
    };
    
    // Update UI to show selection
    document.querySelectorAll('.food-item').forEach(el => {
        el.classList.remove('selected');
        if (el.textContent.includes(item.original_food)) {
            el.classList.add('selected');
        }
    });
    
    // Show confirmation
    showToast(`Selected: ${item.original_food}`, 'success');
    
    // Scroll to meal logging section
    document.getElementById('log-section')?.scrollIntoView({ behavior: 'smooth' });
}

// ==================== Weekly Plan Functions ====================

let currentWeekStart = null;
let lastWeeklyPlan = null;
let weeklyPlanMediaBound = false;

const MEAL_TYPE_ORDER = [
    'breakfast',
    'mid_morning_snack',
    'lunch',
    'evening_snack',
    'dinner',
];

/** Display name for a planned meal (matches Log Meal: summary / food / main). */
function getPlannedMealDisplayName(meal) {
    if (!meal) return '';
    if (meal.display_name) return meal.display_name;
    if (meal.is_complete_meal && meal.summary) return meal.summary;
    return meal.food?.name
        || meal.main?.food?.name
        || meal.main?.food_name
        || '';
}

function isCompactWeeklyPlanView() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function shiftDateISO(iso, days) {
    const d = parseLocalDate(iso);
    d.setDate(d.getDate() + days);
    return localDateISO(d);
}

function formatPlanDayLabel(dateStr) {
    const date = parseLocalDate(dateStr);
    return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });
}

function relativePlanDayLabel(dateStr, todayISO) {
    if (dateStr === todayISO) return 'Today';
    if (dateStr === shiftDateISO(todayISO, -1)) return 'Yesterday';
    if (dateStr === shiftDateISO(todayISO, 1)) return 'Tomorrow';
    return null;
}

function orderedMealEntries(meals) {
    const entries = Object.entries(meals || {});
    entries.sort((a, b) => {
        const ai = MEAL_TYPE_ORDER.indexOf(a[0]);
        const bi = MEAL_TYPE_ORDER.indexOf(b[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return entries;
}

function bindWeeklyPlanMediaListener(toddlerId) {
    if (weeklyPlanMediaBound || !toddlerId) return;
    weeklyPlanMediaBound = true;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => {
        // Crossing the breakpoint needs a reload so week-boundary days are available.
        loadWeeklyPlan(toddlerId, isCompactWeeklyPlanView() ? null : currentWeekStart);
    };
    if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onChange);
    } else if (typeof mq.addListener === 'function') {
        mq.addListener(onChange);
    }
}

async function fetchWeeklyPlanDays(toddlerId, weekStartISO) {
    let url = `/meal-plan/weekly/${toddlerId}`;
    if (weekStartISO) {
        url += `?week_start=${encodeURIComponent(weekStartISO)}`;
    }
    return apiCall(url);
}

/** Phone view: only yesterday / today / tomorrow (fetch adjacent weeks at boundaries). */
async function buildCompactPlanDays(toddlerId) {
    const today = localDateISO();
    const focusDates = [shiftDateISO(today, -1), today, shiftDateISO(today, 1)];
    const daysByDate = {};

    const seed = await fetchWeeklyPlanDays(toddlerId, today);
    currentWeekStart = seed.week_start;
    (seed.days || []).forEach((day) => {
        daysByDate[day.date] = day;
    });

    const missing = focusDates.filter((iso) => !daysByDate[iso]);
    for (const iso of missing) {
        const extra = await fetchWeeklyPlanDays(toddlerId, iso);
        (extra.days || []).forEach((day) => {
            daysByDate[day.date] = day;
        });
    }

    return {
        ...seed,
        compact: true,
        days: focusDates.map((iso) => daysByDate[iso]).filter(Boolean),
    };
}

async function loadWeeklyPlan(toddlerId, weekStart = null) {
    try {
        bindWeeklyPlanMediaListener(toddlerId);

        if (isCompactWeeklyPlanView()) {
            const plan = await buildCompactPlanDays(toddlerId);
            lastWeeklyPlan = plan;
            renderWeeklyPlan(plan);
            return;
        }

        const plan = await fetchWeeklyPlanDays(toddlerId, weekStart);
        currentWeekStart = plan.week_start;
        lastWeeklyPlan = plan;
        renderWeeklyPlan(plan);
    } catch (error) {
        console.error('Failed to load weekly plan:', error);
    }
}

function renderWeeklyPlan(plan) {
    const container = document.getElementById('week-grid');
    if (!container) return;

    const compact = isCompactWeeklyPlanView();
    const today = localDateISO();
    const toddlerId = document.body.dataset.toddlerId;
    const desktopNav = document.querySelector('.week-navigation-desktop');
    const compactHeader = document.getElementById('compact-plan-header');
    const compactTitle = document.getElementById('compact-plan-title');
    const titleEl = document.getElementById('week-title');

    let days = plan.days || [];
    if (compact) {
        const focus = new Set([
            shiftDateISO(today, -1),
            today,
            shiftDateISO(today, 1),
        ]);
        // If we already have a full week cached (desktop→mobile resize), filter locally.
        const filtered = days.filter((day) => focus.has(day.date));
        if (filtered.length) {
            days = filtered.sort((a, b) => a.date.localeCompare(b.date));
        }
    }

    if (titleEl && plan.week_start && plan.week_end) {
        titleEl.textContent = `${formatPlanDayLabel(plan.week_start)} – ${formatPlanDayLabel(plan.week_end)}`;
    }

    if (desktopNav) desktopNav.hidden = compact;
    if (compactHeader) compactHeader.hidden = !compact;
    if (compact && compactTitle) {
        compactTitle.textContent = `${formatPlanDayLabel(shiftDateISO(today, -1))} – ${formatPlanDayLabel(shiftDateISO(today, 1))}`;
    }

    container.classList.toggle('is-compact', compact);

    let html = '';
    days.forEach((day) => {
        const isToday = day.date === today;
        const relative = relativePlanDayLabel(day.date, today);
        const dayClass = [
            'day-card',
            isToday ? 'is-today' : '',
            relative === 'Yesterday' ? 'is-yesterday' : '',
            relative === 'Tomorrow' ? 'is-tomorrow' : '',
        ].filter(Boolean).join(' ');

        const mealRows = orderedMealEntries(day.meals).map(([mealType, meal]) => {
            const name = getPlannedMealDisplayName(meal) || 'Not planned';
            const recipeLinks = buildRecipeLinks(meal, toddlerId);
            return `
                <div class="day-meal">
                    <div class="day-meal-type">
                        <span class="day-meal-icon" aria-hidden="true">${getMealTypeIcon(mealType)}</span>
                        <span>${formatMealType(mealType)}</span>
                    </div>
                    <div class="day-meal-food">${escapeHtml(name)}</div>
                    ${recipeLinks}
                </div>`;
        }).join('');

        html += `
            <article class="${dayClass}">
                <div class="day-header ${isToday ? 'today' : ''}">
                    ${relative ? `<div class="day-relative">${relative}</div>` : ''}
                    <div class="day-name">${escapeHtml(day.day_name || '')}</div>
                    <div class="day-date">${formatPlanDayLabel(day.date)}</div>
                </div>
                <div class="day-meals">
                    ${mealRows || '<p class="day-meals-empty">No meals planned</p>'}
                </div>
            </article>
        `;
    });

    container.innerHTML = html || `
        <div class="empty-state" style="padding: 1.5rem;">
            <p>No meals in this range yet. Tap Regenerate to build a plan.</p>
        </div>
    `;
}

function buildRecipeLinks(meal, toddlerId) {
    if (!toddlerId || !meal) return '';
    const links = [];
    const seen = new Set();
    const add = (slug, label) => {
        if (!slug || seen.has(slug)) return;
        seen.add(slug);
        const href = `/recipes/${toddlerId}?highlight=${encodeURIComponent(slug)}#${encodeURIComponent(slug)}`;
        links.push(`<a class="recipe-plan-link" href="${href}"><i class="fas fa-book-open"></i> ${escapeHtml(label || 'Recipe')}</a>`);
    };

    if (meal.recipe_slug) {
        add(meal.recipe_slug, meal.recipe_name || 'Recipe');
    }
    (meal.recipes || []).forEach((r) => add(r.slug, r.name || 'Recipe'));

    if (!links.length) return '';
    return `<div class="day-meal-recipes">${links.join('')}</div>`;
}

function navigateWeek(direction) {
    if (isCompactWeeklyPlanView()) return;
    if (!currentWeekStart) return;

    const current = parseLocalDate(currentWeekStart);
    current.setDate(current.getDate() + (direction * 7));

    const toddlerId = document.body.dataset.toddlerId;
    loadWeeklyPlan(toddlerId, localDateISO(current));
}

async function regenerateWeeklyPlan(toddlerId) {
    try {
        if (isCompactWeeklyPlanView()) {
            const today = localDateISO();
            const weekStarts = new Set();
            [shiftDateISO(today, -1), today, shiftDateISO(today, 1)].forEach((iso) => {
                const d = parseLocalDate(iso);
                // Match API: normalize to Monday of that week
                d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
                weekStarts.add(localDateISO(d));
            });
            for (const weekStart of weekStarts) {
                await apiCall(
                    `/meal-plan/weekly/${toddlerId}?week_start=${encodeURIComponent(weekStart)}&regenerate=true`
                );
            }
            const plan = await buildCompactPlanDays(toddlerId);
            lastWeeklyPlan = plan;
            renderWeeklyPlan(plan);
            showToast('Meal plan regenerated (past & logged meals kept).', 'success');
            return;
        }

        const qs = currentWeekStart
            ? `?week_start=${encodeURIComponent(currentWeekStart)}&regenerate=true`
            : '?regenerate=true';
        const plan = await apiCall(`/meal-plan/weekly/${toddlerId}${qs}`);
        currentWeekStart = plan.week_start;
        lastWeeklyPlan = plan;
        renderWeeklyPlan(plan);
        showToast('Weekly plan regenerated (past & logged meals kept).', 'success');
    } catch (error) {
        console.error('Failed to regenerate plan:', error);
    }
}

// ==================== Nutrition Page Functions ====================

async function loadWeeklyNutrition(toddlerId) {
    try {
        const daily = await apiCall(`/nutrition/daily/${toddlerId}`);
        renderNutritionStatus(daily.nutrition, toddlerId);

        const data = await apiCall(`/nutrition/weekly/${toddlerId}`);
        renderWeeklyNutrition(data);
        
        const alerts = await apiCall(`/nutrition/alerts/${toddlerId}`);
        renderAlerts(alerts.alerts);

        if (window.location.hash === '#alerts') {
            requestAnimationFrame(() => {
                document.getElementById('alerts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        if (window.location.hash === '#today-breakdown' || window.location.search.includes('view=today')) {
            requestAnimationFrame(() => {
                document.getElementById('today-breakdown')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    } catch (error) {
        console.error('Failed to load nutrition data:', error);
    }
}

function renderWeeklyNutrition(data) {
    const container = document.getElementById('weekly-nutrition');
    if (!container) return;
    
    const nutrients = Object.entries(data.weekly_status || {});
    
    let html = `
        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-icon primary"><i class="fas fa-calendar-check"></i></div>
                <div class="stat-content">
                    <h3>${data.days_tracked}</h3>
                    <p>Days Tracked</p>
                </div>
            </div>
        </div>
        <div class="nutrition-grid">
    `;
    
    nutrients.forEach(([key, nutrient]) => {
        const percentage = Math.min(nutrient.percentage, 150);
        const info = nutrient.info || {};
        
        html += `
            <div class="nutrient-card">
                <div class="nutrient-header">
                    <span class="nutrient-icon">${info.icon || '📊'}</span>
                    <span class="nutrient-name">${info.name || key}</span>
                </div>
                <div class="nutrient-bar">
                    <div class="nutrient-fill ${nutrient.status}" style="width: ${percentage}%"></div>
                </div>
                <div class="nutrient-values">
                    <span>Avg: ${nutrient.daily_average} ${info.unit || ''}/day</span>
                    <span>${nutrient.percentage}%</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// ==================== Preferences Page Functions ====================

async function loadPreferences(toddlerId) {
    try {
        const data = await apiCall(`/preferences/${toddlerId}`);
        renderPreferences(data);
    } catch (error) {
        console.error('Failed to load preferences:', error);
    }
}

function renderPreferences(data) {
    // Render liked / loved foods
    renderPreferenceSection('liked-foods', data.liked, '💚 Loved & Liked', 'liked');
    
    // Render neutral foods
    renderPreferenceSection('neutral-foods', data.neutral, '😐 Neutral', 'neutral');
    
    // Render foods needing re-exposure (refused but < 15 exposures)
    const needsExposure = data.disliked?.filter(p => p.exposures_remaining > 0) || [];
    renderExposureSection('needs-exposure-foods', needsExposure);
    
    // Render challenging foods (refused after 15+ tries)
    const challenging = data.disliked?.filter(p => p.exposures_remaining === 0) || [];
    renderPreferenceSection('disliked-foods', challenging, '🙅 Challenging', 'disliked');
}

function reactionLabel(reaction) {
    const labels = {
        loved: '😍 Loved',
        liked: '😊 Liked',
        neutral: '😐 Okay',
        disliked: '😕 Disliked',
        refused: '🤢 Refused',
    };
    return labels[(reaction || '').toLowerCase()] || '';
}

function renderPreferenceSection(containerId, foods, title, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!foods || foods.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 1rem;">
                <p>No foods in this category yet.</p>
            </div>
        `;
        return;
    }
    
    let html = `<div class="preference-grid">`;
    
    foods.forEach(pref => {
        const acceptRate = pref.acceptance_rate ? `${Math.round(pref.acceptance_rate)}% accepted` : '';
        const lastRx = reactionLabel(pref.last_reaction);
        const emoji = pref.last_reaction === 'loved' ? '😍'
            : pref.last_reaction === 'liked' ? '😊'
            : type === 'liked' ? '😋'
            : type === 'disliked' ? '😣'
            : '😐';
        
        html += `
            <div class="preference-item">
                <div class="preference-score ${type}">
                    ${emoji}
                </div>
                <div class="preference-info">
                    <div class="preference-food">${pref.food?.name || 'Unknown'}</div>
                    <div class="preference-stats">
                        ${lastRx ? `${lastRx} · ` : ''}Offered ${pref.times_offered}x ${acceptRate ? `• ${acceptRate}` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function renderExposureSection(containerId, foods) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!foods || foods.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 1rem;">
                <p>Great! No foods currently need re-exposure.</p>
            </div>
        `;
        return;
    }
    
    let html = `<div class="preference-grid">`;
    
    foods.forEach(pref => {
        const exposuresLeft = pref.exposures_remaining || 0;
        const needsRetry = pref.needs_reexposure;
        
        html += `
            <div class="preference-item" style="${needsRetry ? 'border: 2px solid var(--warning);' : ''}">
                <div class="preference-score" style="background: ${needsRetry ? 'rgba(234, 179, 8, 0.2)' : 'rgba(99, 102, 241, 0.1)'}; color: ${needsRetry ? 'var(--warning)' : 'var(--primary)'};">
                    ${needsRetry ? '🔄' : '📊'}
                </div>
                <div class="preference-info">
                    <div class="preference-food">${pref.food?.name || 'Unknown'}</div>
                    <div class="preference-stats">
                        ${pref.times_offered} of 15 exposures • ${exposuresLeft} more to go
                        ${needsRetry ? '<br><strong style="color: var(--warning);">Ready to retry!</strong>' : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// ==================== Toddler Management ====================

function switchToddler(toddlerId) {
    window.location.href = `/dashboard/${toddlerId}`;
}

async function createToddler(event) {
    if (event) event.preventDefault();
    
    const form = (event && event.target && event.target.tagName === 'FORM')
        ? event.target
        : document.getElementById('onboarding-form') || document.querySelector('.onboarding-form');
    if (!form) {
        showToast('Form not found. Please refresh and try again.', 'error');
        return;
    }

    const submitBtn = form.querySelector('.submit-btn') || document.querySelector('.submit-btn');
    if (submitBtn?.disabled) return;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Creating profile…</span>';
    }
    
    const formData = new FormData(form);
    
    // Get allergies
    const allergies = [];
    form.querySelectorAll('input[name="allergies"]:checked').forEach(el => {
        allergies.push(el.value);
    });
    
    // Get health conditions
    const healthConditions = [];
    form.querySelectorAll('input[name="health_conditions"]:checked').forEach(el => {
        healthConditions.push(el.value);
    });

    const name = (formData.get('name') || '').toString().trim();
    const ageMonths = parseInt(formData.get('age_months'), 10);
    if (!name || !ageMonths) {
        showToast('Please enter name and age in months', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = submitBtn.dataset.originalHtml || 'Start Planning Meals!';
        }
        return;
    }
    
    const data = {
        name,
        age_months: ageMonths,
        birth_date: formData.get('birth_date') || null,
        gender: formData.get('gender') || 'unknown',
        weight_kg: formData.get('weight_kg') ? parseFloat(formData.get('weight_kg')) : null,
        height_cm: formData.get('height_cm') ? parseFloat(formData.get('height_cm')) : null,
        activity_level: formData.get('activity_level') || 'moderate',
        health_conditions: healthConditions,
        dietary_preference: formData.get('dietary_preference') || 'vegetarian',
        allergies: allergies
    };
    
    try {
        const toddler = await apiCall('/toddlers', 'POST', data);
        
        let message = `Welcome, ${toddler.name}!`;
        if (toddler.weight_status && toddler.weight_status !== 'normal') {
            message += ` (${toddler.weight_status.replace('_', ' ')})`;
        }
        showToast(message, 'success');
        
        // Navigate immediately — don't rely on delayed redirect on mobile
        window.location.assign(`/dashboard/${toddler.id}`);
    } catch (error) {
        console.error('Failed to create toddler:', error);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = submitBtn.dataset.originalHtml || '<i class="fas fa-rocket"></i> <span>Start Planning Meals!</span>';
        }
    }
}

// ==================== Search Functions ====================

function initFoodSearch(foods) {
    const searchInput = document.getElementById('food-search');
    if (!searchInput) return;
    
    let debounceTimer;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            renderFoodList(foods, e.target.value);
        }, 300);
    });
}

// ==================== Initialize ====================

document.addEventListener('DOMContentLoaded', () => {
    // Check for page-specific initialization
    const page = document.body.dataset.page;
    const toddlerId = document.body.dataset.toddlerId;
    
    if (page === 'dashboard' && toddlerId) {
        loadDashboard(toddlerId);
    }
    
    if (page === 'weekly-plan' && toddlerId) {
        loadWeeklyPlan(toddlerId);
    }
    
    if (page === 'nutrition' && toddlerId) {
        loadWeeklyNutrition(toddlerId);
    }
    
    if (page === 'preferences' && toddlerId) {
        loadPreferences(toddlerId);
    }
});
