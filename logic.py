last_emotion = "Нейтральна"
smoothed_intensity = 0.0


def analyze_json_data(data):
    global last_emotion, smoothed_intensity

    try:
        frames = data.get("frames", [])
        if not frames:
            return "Нейтральна", 0.0

        # ФУНКЦІЯ 1: Шукає пікові значення у кадрах.
        def get_peak_value(key, look_for_min=False):
            values = [f.get(key, 0.0) for f in frames if key in f]
            if not values:
                return 0.0
            values.sort(reverse=not look_for_min)
            top_n = max(1, len(values) // 4)  # Беремо топ-25%
            return sum(values[:top_n]) / top_n

        # ФУНКЦІЯ 2: Конвертує фізичні значення у відсотки 0.0-1.0
        def normalize(val, min_val, max_val):
            if min_val == max_val: return 0.0
            res = (val - min_val) / (max_val - min_val)
            return max(0.0, min(1.0, res))

        # --- КРОК 1. Витягуємо всі фізичні метрики з JSON ---
        ear_avg = get_peak_value("ear_avg_smooth", look_for_min=True)
        mar = get_peak_value("mar_smooth")
        smile_coeff = get_peak_value("smile_coeff_smooth")
        brow_down_raw = get_peak_value("brow_dist_smooth", look_for_min=True)
        brow_up_raw = get_peak_value("brow_dist_smooth", look_for_min=False)
        nose_wrinkle_raw = get_peak_value("nose_wrinkle_smooth")
        eye_squint_raw = get_peak_value("eye_squint_smooth")

        # --- КРОК 2. Нормалізуємо їх (від 0.0 до 1.0) ---
        features = {
            "smile": normalize(smile_coeff, 0.0, 0.5),
            "lip_down": normalize(smile_coeff, 0.0, -0.3),
            "mouth_open": normalize(mar, 0.0, 0.4),
            "eyes_closed": normalize(ear_avg, 0.32, 0.05),
            "brows_down": normalize(brow_down_raw, 0.13, 0.09),
            "brows_up": normalize(brow_up_raw, 0.13, 0.16),
            "nose_wrinkle": normalize(nose_wrinkle_raw, 0.0, 0.5),
            "eye_squint": normalize(eye_squint_raw, 0.0, 0.5),
        }

        # --- КРОК 3. Обчислюємо 8 емоцій суворо за даними ---
        scores = {
            "Excited": (features["smile"] * 0.4 + features["brows_up"] * 0.3 + features["mouth_open"] * 0.3),
            "Happy": (features["smile"] * 0.7 + features["eye_squint"] * 0.3),
            "Angry": (features["brows_down"] * 0.6 + features["eye_squint"] * 0.4),
            "Sad": (features["lip_down"] * 0.7 + features["brows_up"] * 0.3),
            "unpleasant": (features["nose_wrinkle"] * 0.7 + features["lip_down"] * 0.3),
            "suspicious": (features["eye_squint"] * 0.7 + features["brows_down"] * 0.3),
            "Sleep": (features["eyes_closed"] * 1.0) - (features["mouth_open"] * 0.4),
            "Sleepy": (features["eyes_closed"] * 0.5 + features["mouth_open"] * 0.5)
        }

        # --- КРОК 4. Знаходимо найсильнішу та стабілізуємо ---
        raw_emotion = max(scores, key=scores.get)
        raw_intensity = max(0.0, min(1.0, scores[raw_emotion]))

        # Гістерезис (захист від смикання емоцій)
        if raw_intensity < 0.20:
            target_emotion = "Нейтральна"
            target_intensity = 0.0
        else:
            if raw_emotion != last_emotion and raw_intensity > 0.35:
                target_emotion = raw_emotion
            else:
                target_emotion = raw_emotion if raw_emotion == last_emotion else last_emotion

            target_intensity = raw_intensity if target_emotion == raw_emotion else raw_intensity * 0.5

        # Плавне згладжування інтенсивності (EMA)
        smoothed_intensity = (smoothed_intensity * 0.4) + (target_intensity * 0.6)
        last_emotion = target_emotion

        if smoothed_intensity < 0.1:
            return "Нейтральна", 0.0

        return last_emotion, smoothed_intensity

    except Exception as e:
        print(f"Помилка аналізу: {e}")
        return "Нейтральна", 0.0