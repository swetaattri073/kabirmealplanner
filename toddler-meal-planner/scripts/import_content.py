#!/usr/bin/env python3
"""
Import foods and recipes from scripts/content/*.json into the LittleBowl database.

Usage (from repo root):
  python scripts/import_content.py              # import foods + recipes
  python scripts/import_content.py --dry-run    # preview only
  python scripts/import_content.py --foods-only
  python scripts/import_content.py --recipes-only
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

CONTENT_DIR = Path(__file__).resolve().parent / "content"
FOODS_JSON = CONTENT_DIR / "new_foods.json"
RECIPES_JSON = CONTENT_DIR / "new_recipes.json"


def _load_json(path: Path) -> list:
    if not path.exists():
        print(f"Missing file: {path}")
        return []
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON array")
    return data


def import_foods(db, Food, dry_run: bool = False) -> tuple[int, int, int]:
    from food_database import _food_from_dict, INDIAN_FOODS

    existing = {f.name for f in Food.query.all()}
    seeded = {d["name"] for d in INDIAN_FOODS}
    items = _load_json(FOODS_JSON)

    added = skipped_db = skipped_seed = 0
    for food_data in items:
        name = food_data.get("name")
        if not name:
            continue
        if name in existing:
            skipped_db += 1
            print(f"  skip (in DB): {name}")
            continue
        if name in seeded and name not in existing:
            # Will be added by init; still allow explicit import
            pass
        if dry_run:
            print(f"  would add food: {name}")
            added += 1
            continue
        db.session.add(_food_from_dict(food_data))
        existing.add(name)
        added += 1
        print(f"  added food: {name}")

    if not dry_run and added:
        db.session.commit()
    return added, skipped_db, skipped_seed


def import_recipes(db, Recipe, dry_run: bool = False) -> tuple[int, int]:
    from recipes import slugify_recipe_name

    existing_slugs = {r.slug for r in Recipe.query.all()}
    items = _load_json(RECIPES_JSON)

    added = skipped = 0
    for item in items:
        name = item.get("name")
        if not name:
            continue
        slug = slugify_recipe_name(name)
        if slug in existing_slugs:
            skipped += 1
            print(f"  skip (in DB): {name}")
            continue
        if dry_run:
            print(f"  would add recipe: {name}")
            added += 1
            continue
        row = Recipe(
            slug=slug,
            name=name,
            category=item.get("category") or "combo",
            why=item.get("why") or "",
            cheese=item.get("cheese") or "",
            steps=item.get("steps") or "",
            food_names=item.get("food_names") or [name],
            allergens=item.get("allergens") or [],
            suitable_from_months=item.get("suitable_from_months"),
            cover_image_path=item.get("cover_image_url"),
            video_url=item.get("video_url"),
            video_platform=item.get("video_platform"),
            is_published=item.get("is_published", True),
            sort_order=item.get("sort_order", 0),
            source=item.get("source", "import"),
        )
        db.session.add(row)
        existing_slugs.add(slug)
        added += 1
        print(f"  added recipe: {name}")

    if not dry_run and added:
        db.session.commit()
    return added, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="Import LittleBowl content JSON into the database.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB")
    parser.add_argument("--foods-only", action="store_true")
    parser.add_argument("--recipes-only", action="store_true")
    args = parser.parse_args()

    from app import app, db
    from models import Food, Recipe

    do_foods = not args.recipes_only
    do_recipes = not args.foods_only

    with app.app_context():
        print("=== LittleBowl content import ===")
        if args.dry_run:
            print("(dry run — no database writes)")

        if do_foods:
            print(f"\nFoods from {FOODS_JSON.name}:")
            added, skipped_db, _ = import_foods(db, Food, dry_run=args.dry_run)
            print(f"  → {added} added, {skipped_db} already in DB")

        if do_recipes:
            print(f"\nRecipes from {RECIPES_JSON.name}:")
            added, skipped = import_recipes(db, Recipe, dry_run=args.dry_run)
            print(f"  → {added} added, {skipped} already in DB")

        print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
