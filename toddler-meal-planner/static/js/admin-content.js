/**
 * Admin content CMS — recipes (video + cover) and shared food catalog.
 */

function adminContentEsc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showContentMsg(text, isError) {
    const err = document.getElementById('admin-content-error');
    const ok = document.getElementById('admin-content-ok');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    if (ok) { ok.style.display = 'none'; ok.textContent = ''; }
    const el = isError ? err : ok;
    if (!el) return;
    el.style.display = 'block';
    el.textContent = text;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function loadAdminRecipes() {
    const tbody = document.querySelector('#admin-recipes-table tbody');
    if (!tbody) return;
    try {
        const res = await fetch('/api/admin/recipes', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to load recipes');
        const data = await res.json();
        const recipes = data.recipes || [];
        if (!recipes.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="admin-muted">No admin recipes yet.</td></tr>';
            return;
        }
        tbody.innerHTML = recipes.map((r) => `
            <tr>
                <td>${r.cover_image_path ? `<img src="${adminContentEsc(r.cover_image_path)}" alt="" style="width:56px;height:40px;object-fit:cover;border-radius:6px;">` : '—'}</td>
                <td>
                    <strong>${adminContentEsc(r.name)}</strong>
                    <div class="admin-muted">${adminContentEsc(r.category)}</div>
                </td>
                <td>${r.video_url ? `<a href="${adminContentEsc(r.video_url)}" target="_blank" rel="noopener">${adminContentEsc(r.video_platform || 'video')}</a>` : '—'}</td>
                <td>${r.is_published ? 'Yes' : 'No'}</td>
                <td>
                    <button type="button" class="btn btn-outline btn-sm" data-del-recipe="${r.db_id}">Delete</button>
                </td>
            </tr>
        `).join('');
        tbody.querySelectorAll('[data-del-recipe]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this recipe for all users?')) return;
                const id = btn.getAttribute('data-del-recipe');
                const del = await fetch(`/api/admin/recipes/${id}`, { method: 'DELETE', credentials: 'same-origin' });
                if (!del.ok) {
                    showContentMsg('Could not delete recipe', true);
                    return;
                }
                showContentMsg('Recipe deleted');
                loadAdminRecipes();
            });
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="admin-muted">${adminContentEsc(e.message)}</td></tr>`;
    }
}

async function loadAdminFoods() {
    const tbody = document.querySelector('#admin-foods-table tbody');
    if (!tbody) return;
    try {
        const res = await fetch('/api/admin/foods', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to load foods');
        const data = await res.json();
        const foods = data.foods || [];
        if (!foods.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="admin-muted">No recently added catalog items.</td></tr>';
            return;
        }
        tbody.innerHTML = foods.map((f) => `
            <tr>
                <td><strong>${adminContentEsc(f.name)}</strong></td>
                <td>${adminContentEsc(f.category)}</td>
                <td>${f.suitable_from_months ?? '—'}</td>
                <td>${f.calories ?? 0}</td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="admin-muted">${adminContentEsc(e.message)}</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const coverInput = document.getElementById('recipe-cover');
    const preview = document.getElementById('recipe-cover-preview');
    if (coverInput && preview) {
        coverInput.addEventListener('change', async () => {
            const dataUrl = await fileToDataUrl(coverInput.files[0]);
            if (dataUrl) {
                preview.src = dataUrl;
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }
        });
    }

    const alsoRecipe = document.getElementById('food-also-recipe');
    const extra = document.getElementById('food-recipe-extra');
    if (alsoRecipe && extra) {
        alsoRecipe.addEventListener('change', () => {
            extra.style.display = alsoRecipe.checked ? 'block' : 'none';
        });
    }

    const recipeForm = document.getElementById('admin-recipe-form');
    if (recipeForm) {
        recipeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const coverData = await fileToDataUrl(document.getElementById('recipe-cover').files[0]);
                const payload = {
                    name: document.getElementById('recipe-name').value.trim(),
                    category: document.getElementById('recipe-category').value,
                    food_names: document.getElementById('recipe-food-names').value,
                    why: document.getElementById('recipe-why').value,
                    steps: document.getElementById('recipe-steps').value,
                    cheese: document.getElementById('recipe-cheese').value,
                    suitable_from_months: document.getElementById('recipe-from').value,
                    video_url: document.getElementById('recipe-video').value.trim(),
                    is_published: document.getElementById('recipe-published').checked,
                    cover_image_data: coverData,
                };
                const res = await fetch('/api/admin/recipes', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify(payload),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error || 'Failed to publish recipe');
                showContentMsg(body.message || 'Recipe published');
                recipeForm.reset();
                if (preview) preview.style.display = 'none';
                document.getElementById('recipe-published').checked = true;
                loadAdminRecipes();
            } catch (err) {
                showContentMsg(err.message, true);
            }
        });
    }

    const foodForm = document.getElementById('admin-food-form');
    if (foodForm) {
        foodForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const also = document.getElementById('food-also-recipe').checked;
                const coverData = also
                    ? await fileToDataUrl(document.getElementById('food-cover').files[0])
                    : null;
                const payload = {
                    name: document.getElementById('food-name').value.trim(),
                    category: document.getElementById('food-category').value,
                    suitable_from_months: document.getElementById('food-from').value,
                    calories: document.getElementById('food-calories').value,
                    protein_g: document.getElementById('food-protein').value,
                    iron_mg: document.getElementById('food-iron').value,
                    preparation_tips: document.getElementById('food-tips').value,
                    also_create_recipe: also,
                    video_url: also ? document.getElementById('food-video').value.trim() : null,
                    cover_image_data: coverData,
                };
                const res = await fetch('/api/admin/foods', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify(payload),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error || 'Failed to add food');
                showContentMsg(body.message || 'Food added');
                foodForm.reset();
                document.getElementById('food-from').value = 12;
                document.getElementById('food-recipe-extra').style.display = 'none';
                loadAdminFoods();
                if (also) loadAdminRecipes();
            } catch (err) {
                showContentMsg(err.message, true);
            }
        });
    }

    loadAdminRecipes();
    loadAdminFoods();
});
