# Muscle Fuel Tracker

Build a production-quality personal nutrition + muscle-gain tracking web app for me. Goal: I am 64 kg, 170 cm, age 27, targeting a healthy gradual gain toward 70 kg while keeping waist controlled and building visible abs/muscle. Starting daily targets should be configurable, with initial defaults around 2,550 kcal/day and 130 g protein/day; also track carbs, fats, water, creatine, weight, waist, workouts, and sleep. Core workflow: I want to log meals by uploading/taking a food photo and/or entering meal details. The app should provide a clear place to attach a meal photo, estimate calories/macros when data is entered, show that estimates from photos are approximate and allow me to correct serving sizes/values, then save the meal. Include meal categories breakfast/lunch/pre-workout/post-workout/dinner/snack. Dashboard must show Today, Yesterday, This Week, Last Week, This Month, Last Month, and custom date range, with calories consumed vs target, protein consumed vs target, macros, meal history, weekly/monthly trends, weight trend, waist trend, workout consistency, sleep, and creatine adherence. Include progress rings/cards, charts, and a clean mobile-first UI suitable for phone use. Add a daily goal progress section showing remaining calories and protein, and a weekly average section. Include an onboarding/settings page where I can change calorie/protein targets, body weight, height, age, and goal. Add an 'Add Meal' flow with photo attachment, food name, serving amount, calories, protein, carbs, fat, notes, and date/time. Make all data persist in Supabase with authentication so it works as a real website across devices. Use row-level security so each user only sees their own data. Create tables for profiles, meals, daily_metrics (weight, waist, sleep, water, creatine, workout minutes), and goals. Include sensible indexes and secure RLS policies. The app should be polished, fast, responsive, and not pretend photo calorie estimates are exact. For now, photo analysis can be represented by a clearly labeled approximate-estimate workflow/manual correction if no vision backend is available; structure the code so an AI food-analysis API can be added later. Use a dark/modern fitness aesthetic, accessible controls, and no fake data after onboarding except a small demo state clearly marked as demo. Include exportable history if practical.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://macroforge-muscle-fuel.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4498c24a-0286-4d4c-88ed-efe0b70ed938).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
