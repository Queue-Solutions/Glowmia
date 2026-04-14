def score_dress(dress, prefs):
    score = 0

    # COLOR
    if prefs["color"] and dress.get("color") == prefs["color"]:
        score += 4

    # OCCASION
    if prefs["occasion"]:
        for occ in prefs["occasion"]:
            if occ in (dress.get("occasion") or []):
                score += 3

    # STYLE
    if prefs["style"]:
        for style in prefs["style"]:
            if style in (dress.get("style") or []):
                score += 2

    # DESCRIPTION bonus
    description = (dress.get("description") or "").lower()
    for word in prefs["style"]:
        if word in description:
            score += 1

    return score


def recommend_dresses(dresses, prefs):
    scored = []

    for dress in dresses:
        s = score_dress(dress, prefs)
        scored.append((s, dress))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [d for s, d in scored if s > 0][:3]  # top 3