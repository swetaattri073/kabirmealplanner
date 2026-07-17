"""Recipe library — ported from the React defaultProfile.js recipes tab."""

RECIPES = [
    {
        "name": "Paneer Pasta",
        "why": "Pasta is already an easy nutrition carrier for many toddlers.",
        "cheese": "Use a cheese cube or skip it — paneer is the main protein here.",
        "steps": "Blend paneer + milk + tiny boiled pumpkin/carrot + butter. Mix with pasta. Keep sauce light in color.",
    },
    {
        "name": "Cheese Corn Paratha",
        "why": "Similar to paneer paratha — mild and familiar.",
        "cheese": "Use a cheese slice or grated mozzarella. Avoid too much processed cheese daily.",
        "steps": "Mash boiled corn + potato + cheese. Stuff lightly in paratha. Serve with curd.",
    },
    {
        "name": "Curd Rice Balls",
        "why": "Uses common safe foods: white rice, curd, ghee, in a finger-food format.",
        "cheese": "No cheese needed.",
        "steps": "Mix cold rice + curd + ghee. Make small balls. Keep them plain; avoid mixing in colored dal/sabji.",
    },
    {
        "name": "Mini Pizza Toast",
        "why": "Fun format that can hide a little veggie sauce.",
        "cheese": "Use mozzarella or a grated cheese cube. Keep the layer thin.",
        "steps": "Bread + very light hidden pumpkin/carrot sauce + cheese. Toast and cut into fingers.",
    },
    {
        "name": "Paneer Dosa",
        "why": "Close to the idli/dosa family many toddlers already accept.",
        "cheese": "Optional cheese spread — paneer mash is enough.",
        "steps": "Make a plain dosa. Add paneer mash + ghee. Fold and cut into strips.",
    },
    {
        "name": "Ragi Banana Pancake",
        "why": "Similar to a regular pancake, but adds iron.",
        "cheese": "No cheese needed.",
        "steps": "Mix banana + ragi flour + milk/egg + nut powder. Cook small pancakes in ghee.",
    },
    {
        "name": "Cheese Toast Fingers",
        "why": "Good snack when a dry, predictable texture is wanted.",
        "cheese": "Use a cheese slice for easiest melting, or grated cheese cube.",
        "steps": "Toast bread with a thin cheese layer. Cut into long fingers. Offer cucumber on the side.",
    },
    {
        "name": "Stuffed Idli",
        "why": "Uses an accepted idli format with hidden protein.",
        "cheese": "Optional tiny grated cheese cube — paneer stuffing works better nutritionally.",
        "steps": "Add idli batter, then a tiny paneer mash, then batter again. Steam as usual.",
    },
]


def list_recipes():
    return list(RECIPES)
