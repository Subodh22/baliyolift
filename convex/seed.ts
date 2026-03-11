import { mutation } from "./_generated/server";
import { v } from "convex/values";

type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "abs"
  | "forearms";

type Equipment =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "other";

type SFR = "high" | "medium" | "low";

interface ExerciseSeed {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  sfr: SFR;
  instructions: string;
}

// NOTE: Convex mutations cannot import from outside the convex/ directory.
// This data is inlined directly from data/exercises.ts.
const EXERCISE_SEED_DATA: ExerciseSeed[] = [
  // CHEST
  {
    name: "Incline Barbell Press",
    muscleGroup: "chest",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Set bench to 30–45 degrees, unrack the bar and lower it to upper chest with control. Press back to full extension without flaring elbows excessively.",
  },
  {
    name: "Incline Dumbbell Press",
    muscleGroup: "chest",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Lie on an incline bench holding dumbbells at chest height, then press them up and together. Lower slowly to get a full stretch at the bottom.",
  },
  {
    name: "Flat Barbell Press",
    muscleGroup: "chest",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Lie flat on bench, lower barbell to mid-chest with a controlled tempo. Press explosively back to lockout while keeping shoulder blades retracted.",
  },
  {
    name: "Flat Dumbbell Press",
    muscleGroup: "chest",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Lie flat on bench with dumbbells at chest level, press them up and slightly together. Allow elbows to drop below bench level for a full pectoral stretch.",
  },
  {
    name: "Cable Fly",
    muscleGroup: "chest",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Set cables at shoulder height, step forward and bring handles together in a hugging arc in front of your chest. Maintain a slight elbow bend and feel the stretch at full extension.",
  },
  {
    name: "Pec Deck Machine",
    muscleGroup: "chest",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Sit upright with forearms on the pads, then squeeze arms together until pads meet in front of you. Control the return to feel a full stretch across the chest.",
  },
  {
    name: "Dips",
    muscleGroup: "chest",
    equipment: "bodyweight",
    sfr: "medium",
    instructions:
      "Lean forward slightly on parallel bars and lower your body until upper arms are parallel to the floor. Press back up through the chest rather than the triceps.",
  },
  {
    name: "Incline Cable Fly",
    muscleGroup: "chest",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Set cables low, lie on an incline bench and arc handles upward to meet above your upper chest. Keep elbows soft and focus on the upper pec stretch at the bottom.",
  },
  {
    name: "Low-to-High Cable Fly",
    muscleGroup: "chest",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Set cables at the lowest position and sweep handles upward and inward toward shoulder height. This targets the upper chest with constant tension through the full arc.",
  },
  {
    name: "Push-Up",
    muscleGroup: "chest",
    equipment: "bodyweight",
    sfr: "medium",
    instructions:
      "Start in a high plank with hands slightly wider than shoulder-width and lower your chest to the floor. Press back up explosively while keeping the core tight throughout.",
  },
  {
    name: "Decline Press",
    muscleGroup: "chest",
    equipment: "barbell",
    sfr: "low",
    instructions:
      "Lie on a decline bench and lower the barbell to your lower chest. Press back to lockout — note the reduced stretch makes this less efficient for hypertrophy.",
  },
  {
    name: "DB Pullover",
    muscleGroup: "chest",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Lie perpendicular on a bench holding one dumbbell above your chest, then lower it in an arc behind your head. Pull it back over using the chest and lats working together.",
  },

  // BACK
  {
    name: "Lat Pulldown",
    muscleGroup: "back",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Grip the bar slightly wider than shoulder-width, lean back slightly and pull the bar to upper chest. Focus on driving your elbows down and back to maximize lat engagement.",
  },
  {
    name: "Cable Row",
    muscleGroup: "back",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Sit at the cable row station, keep your torso upright and pull the handle into your lower sternum. Squeeze the shoulder blades together at the end of each rep.",
  },
  {
    name: "Barbell Row",
    muscleGroup: "back",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Hinge to roughly 45 degrees with a flat back, then row the bar to your lower ribcage. Keep the bar path close to your body and avoid using momentum.",
  },
  {
    name: "Dumbbell Row",
    muscleGroup: "back",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Support yourself with one hand on a bench, let the dumbbell hang fully then drive it toward your hip. Allow full shoulder depression at the bottom for maximum lat stretch.",
  },
  {
    name: "Chest-Supported Row",
    muscleGroup: "back",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Lie face-down on an incline bench and row dumbbells toward your hips. The chest support eliminates lower back fatigue and keeps tension purely on the back.",
  },
  {
    name: "T-Bar Row",
    muscleGroup: "back",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Straddle the T-bar with a flat back and row the weight to your lower chest. Use a neutral grip and drive the elbows back for strong mid-back activation.",
  },
  {
    name: "Pull-Up",
    muscleGroup: "back",
    equipment: "bodyweight",
    sfr: "medium",
    instructions:
      "Hang from a bar with an overhand grip and pull your chin above the bar. Lower slowly to a full dead hang to maximize the lat stretch each rep.",
  },
  {
    name: "Chin-Up",
    muscleGroup: "back",
    equipment: "bodyweight",
    sfr: "medium",
    instructions:
      "Use an underhand shoulder-width grip and pull until your chin clears the bar. The supinated grip increases bicep involvement alongside the lats.",
  },
  {
    name: "Straight-Arm Pulldown",
    muscleGroup: "back",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Stand at a high cable with arms extended, then sweep the bar down to your thighs with straight arms. This isolates the lats without bicep involvement.",
  },
  {
    name: "Seated Cable Row Wide Grip",
    muscleGroup: "back",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Use a wide bar attachment and pull it to your upper abdomen with elbows flaring out. This emphasizes the upper back and rear delts more than a close grip.",
  },
  {
    name: "Single-Arm Cable Row",
    muscleGroup: "back",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Pull a single cable handle to your hip with full rotation at the shoulder. The unilateral setup allows a greater range of motion and lat stretch.",
  },
  {
    name: "Deadlift",
    muscleGroup: "back",
    equipment: "barbell",
    sfr: "low",
    instructions:
      "Set up with bar over mid-foot, hinge down and grip the bar, then drive through the floor to lockout. Extremely taxing systemically — use sparingly for hypertrophy.",
  },
  {
    name: "Romanian Deadlift",
    muscleGroup: "back",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Hold the bar at hip level and hinge back with soft knees until you feel a deep hamstring stretch. Drive the hips forward to return to standing.",
  },
  {
    name: "Rack Pull",
    muscleGroup: "back",
    equipment: "barbell",
    sfr: "low",
    instructions:
      "Pull from pins set at knee height to emphasize the upper back. Still highly taxing — best used sparingly as a strength builder rather than a hypertrophy staple.",
  },

  // SHOULDERS
  {
    name: "Dumbbell Lateral Raise",
    muscleGroup: "shoulders",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Raise dumbbells out to the side until arms are parallel to the floor. Lead with the elbow and keep a slight forward lean to hit the mid-delt optimally.",
  },
  {
    name: "Cable Lateral Raise",
    muscleGroup: "shoulders",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Stand beside a low cable and raise the handle out to shoulder height. Cable provides constant tension unlike dumbbells, maximizing stimulus throughout the range.",
  },
  {
    name: "Machine Lateral Raise",
    muscleGroup: "shoulders",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Sit on the machine and raise your arms against the pads to shoulder level. Machines provide a smooth resistance curve that keeps tension on the mid-delt.",
  },
  {
    name: "Overhead Press Barbell",
    muscleGroup: "shoulders",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Press the bar from shoulder level to full overhead lockout with a vertical bar path. Brace the core hard and avoid excessive lumbar extension at the top.",
  },
  {
    name: "Overhead Press Dumbbell",
    muscleGroup: "shoulders",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Press dumbbells from shoulder height to overhead, allowing natural wrist rotation. Greater range of motion and shoulder freedom compared to the barbell version.",
  },
  {
    name: "Arnold Press",
    muscleGroup: "shoulders",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Start with dumbbells in front of your face palms-in, rotate and press overhead simultaneously. The rotation recruits more of the anterior and mid-delt.",
  },
  {
    name: "Rear Delt Fly Machine",
    muscleGroup: "shoulders",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Sit facing the pad and reverse the pec deck to fly your arms back behind you. Keep elbows slightly bent and focus on the contraction in the rear delts.",
  },
  {
    name: "Cable Face Pull",
    muscleGroup: "shoulders",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Set the cable at face height with a rope attachment and pull it toward your forehead, flaring elbows wide. This targets the rear delts and external rotators.",
  },
  {
    name: "Reverse Pec Deck",
    muscleGroup: "shoulders",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Face the machine and sweep the handles backward in a wide arc. This isolates the rear delts with minimal bicep and trap involvement.",
  },
  {
    name: "Upright Row",
    muscleGroup: "shoulders",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Pull the bar straight up along your body to chin height with elbows leading. Use a shoulder-width grip to reduce impingement risk.",
  },
  {
    name: "Front Raise",
    muscleGroup: "shoulders",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Raise dumbbells forward to shoulder height with a controlled tempo. The anterior delt is often sufficiently trained by pressing, so use this as a supplementary movement.",
  },

  // BICEPS
  {
    name: "Incline Dumbbell Curl",
    muscleGroup: "biceps",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Lie back on a 45-degree incline bench and curl dumbbells from a fully stretched position. The incline places the long head of the bicep under maximal stretch.",
  },
  {
    name: "Cable Curl",
    muscleGroup: "biceps",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Stand at a low cable and curl the bar or rope to your chin. Cables maintain tension at the bottom of the curl unlike free weights.",
  },
  {
    name: "EZ Bar Curl",
    muscleGroup: "biceps",
    equipment: "barbell",
    sfr: "high",
    instructions:
      "Grip the EZ bar at the inner angled sections and curl from full extension to chin height. The angled grip reduces wrist strain compared to a straight bar.",
  },
  {
    name: "Barbell Curl",
    muscleGroup: "biceps",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Curl the straight bar from full extension to the top with elbows pinned at your sides. More systemic demand than cable variations due to the instability.",
  },
  {
    name: "Hammer Curl",
    muscleGroup: "biceps",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Curl dumbbells with a neutral grip to target the brachialis and brachioradialis. Keep the wrists neutral throughout the movement.",
  },
  {
    name: "Preacher Curl Machine",
    muscleGroup: "biceps",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Rest upper arms on the preacher pad and curl the handles to full contraction. The pad prevents cheating and keeps continuous tension on the biceps.",
  },
  {
    name: "Spider Curl",
    muscleGroup: "biceps",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Lie face-down on an incline bench and curl dumbbells from a hanging position. This variation maximizes peak contraction at the top of each rep.",
  },
  {
    name: "Concentration Curl",
    muscleGroup: "biceps",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Sit with elbow braced against inner thigh and curl the dumbbell to full contraction. Excellent isolation exercise with minimal opportunity to cheat.",
  },
  {
    name: "Drag Curl",
    muscleGroup: "biceps",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Pull the bar up along your torso by dragging elbows back rather than curling. This keeps the long head under tension and reduces anterior delt recruitment.",
  },
  {
    name: "Cross-Body Hammer Curl",
    muscleGroup: "biceps",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Curl the dumbbell across your body toward the opposite shoulder with a neutral grip. This targets the brachialis and long head of the bicep.",
  },

  // TRICEPS
  {
    name: "Cable Overhead Tricep Extension",
    muscleGroup: "triceps",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Face away from the cable with the rope behind your head and extend arms overhead to full lockout. This stretches the long head under load — the most effective tricep movement.",
  },
  {
    name: "Overhead DB Extension",
    muscleGroup: "triceps",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Hold one dumbbell overhead with both hands and lower it behind your head. Extend to full lockout, keeping elbows pointing forward throughout.",
  },
  {
    name: "Cable Pushdown",
    muscleGroup: "triceps",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Stand at a high cable and push the bar or rope down to full extension. Keep elbows tucked at your sides and control the return for constant tension.",
  },
  {
    name: "EZ Bar Skull Crusher",
    muscleGroup: "triceps",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Lie flat and lower the EZ bar toward your forehead by hinging only at the elbows. Press back to full extension — a potent mass builder with moderate fatigue.",
  },
  {
    name: "Close-Grip Bench Press",
    muscleGroup: "triceps",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Use a shoulder-width grip on the bench press and lower the bar to mid-chest. The narrow grip shifts emphasis to the triceps with significant loading capacity.",
  },
  {
    name: "Dips Tricep Focus",
    muscleGroup: "triceps",
    equipment: "bodyweight",
    sfr: "medium",
    instructions:
      "Stay upright on parallel bars and dip straight down without leaning forward. An upright torso shifts the emphasis from chest to triceps.",
  },
  {
    name: "Machine Tricep Extension",
    muscleGroup: "triceps",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Sit at the tricep extension machine and press the pads down to full arm extension. Machines allow easy load management and consistent tension.",
  },
  {
    name: "Single-Arm Cable Pushdown",
    muscleGroup: "triceps",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Use one hand on a cable handle and push down to full extension. Unilateral training allows greater range of motion and addresses left-right imbalances.",
  },

  // QUADS
  {
    name: "Leg Press",
    muscleGroup: "quads",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Place feet low on the platform and press to near lockout, then lower until knees are at 90 degrees. A foot plate position allows significant quad loading with low spinal stress.",
  },
  {
    name: "Hack Squat Machine",
    muscleGroup: "quads",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Place feet low and shoulder-width on the hack squat and descend to full depth. The machine tracks force vertically, providing excellent quad stimulus.",
  },
  {
    name: "Bulgarian Split Squat",
    muscleGroup: "quads",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Elevate rear foot on a bench and lower the front knee toward the floor. Upright torso targets quads; lean forward slightly to involve more glutes.",
  },
  {
    name: "Leg Extension",
    muscleGroup: "quads",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Sit on the machine and extend the legs to full lockout, pausing at the top. This isolates the quads with no hip involvement and excellent stretch at the bottom.",
  },
  {
    name: "Barbell Back Squat",
    muscleGroup: "quads",
    equipment: "barbell",
    sfr: "low",
    instructions:
      "Squat with the bar on your upper traps to below parallel. Highly effective for strength but creates significant systemic fatigue — program carefully for hypertrophy.",
  },
  {
    name: "Front Squat",
    muscleGroup: "quads",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Hold the bar across front deltoids and squat to full depth with an upright torso. Greater quad emphasis than back squat with less spinal loading.",
  },
  {
    name: "Walking Lunge",
    muscleGroup: "quads",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Step forward into a lunge, lowering the back knee close to the floor, then drive up and step forward. Significant quad and glute demand with added stability challenge.",
  },
  {
    name: "Sissy Squat",
    muscleGroup: "quads",
    equipment: "bodyweight",
    sfr: "high",
    instructions:
      "Hold a support, lean back and bend knees to lower your body while keeping hips extended. This maximizes the quad stretch under load with minimal hamstring involvement.",
  },
  {
    name: "Smith Machine Squat",
    muscleGroup: "quads",
    equipment: "machine",
    sfr: "medium",
    instructions:
      "Place feet slightly forward on the Smith machine and squat to full depth. The fixed bar path reduces stability demands and allows quad-focused positioning.",
  },
  {
    name: "Goblet Squat",
    muscleGroup: "quads",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Hold a dumbbell at your chest and squat to full depth with an upright torso. Great for beginners and as a warm-up movement for quad development.",
  },

  // HAMSTRINGS
  {
    name: "Lying Leg Curl",
    muscleGroup: "hamstrings",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Lie face-down on the machine and curl the pad toward your glutes. Slow the lowering phase to maximize hamstring time under tension.",
  },
  {
    name: "Seated Leg Curl",
    muscleGroup: "hamstrings",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Sit upright on the machine and curl through the full range of motion. The seated position places the hamstrings under stretch at both the hip and knee.",
  },
  {
    name: "Romanian Deadlift",
    muscleGroup: "hamstrings",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Keep the bar close to your legs as you hinge to feel a deep hamstring stretch. Drive the hips forward to return — excellent for hamstring length under load.",
  },
  {
    name: "Nordic Hamstring Curl",
    muscleGroup: "hamstrings",
    equipment: "bodyweight",
    sfr: "high",
    instructions:
      "Anchor your feet and lower your body toward the floor with straight hips by slowly letting the knees extend. One of the most effective hamstring exercises for injury prevention.",
  },
  {
    name: "Stiff-Leg Deadlift",
    muscleGroup: "hamstrings",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Lower the bar with minimal knee bend to maximize hamstring stretch. Keep a neutral spine and avoid rounding the lower back.",
  },
  {
    name: "Good Morning",
    muscleGroup: "hamstrings",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Bar on upper back, hinge forward at the hips with soft knees until torso is near parallel. Drive back up through the hips — trains the hamstring and spinal erectors.",
  },
  {
    name: "Single-Leg Romanian Deadlift",
    muscleGroup: "hamstrings",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Balance on one leg and hinge forward lowering the dumbbell toward the floor. Excellent unilateral hamstring stretch with added balance demand.",
  },
  {
    name: "Cable Pull-Through",
    muscleGroup: "hamstrings",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Face away from a low cable, hinge through your legs and drive your hips forward to stand. This hip-hinge pattern loads the hamstrings and glutes with constant cable tension.",
  },

  // GLUTES
  {
    name: "Hip Thrust",
    muscleGroup: "glutes",
    equipment: "barbell",
    sfr: "high",
    instructions:
      "Rest upper back on a bench with bar across hips, drive hips to full extension and squeeze at the top. The loaded peak contraction position makes this the premier glute exercise.",
  },
  {
    name: "Glute Bridge",
    muscleGroup: "glutes",
    equipment: "bodyweight",
    sfr: "high",
    instructions:
      "Lie on your back with knees bent and drive hips straight up to full extension. Add a band above the knees to increase glute medius recruitment.",
  },
  {
    name: "Cable Kickback",
    muscleGroup: "glutes",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Attach an ankle cuff to a low cable and kick the leg straight back to full hip extension. Squeeze the glute hard at the top of each rep.",
  },
  {
    name: "Bulgarian Split Squat Glute Focus",
    muscleGroup: "glutes",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Elevate rear foot and lean the torso slightly forward as you lower, biasing the glutes over the quads. Drive through the front heel to emphasize glute recruitment.",
  },
  {
    name: "Romanian Deadlift Glute Focus",
    muscleGroup: "glutes",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Hinge with a deliberate glute squeeze at the top and push hips back intentionally on the way down. Thinking about glute activation shifts emphasis away from the hamstrings.",
  },
  {
    name: "Abductor Machine",
    muscleGroup: "glutes",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Sit in the machine and press the pads outward against resistance. This targets the glute medius — an often undertrained area crucial for hip stability.",
  },
  {
    name: "Step Up",
    muscleGroup: "glutes",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Step onto a bench and drive through the heel of the front foot to fully extend the hip. Lower slowly and avoid pushing off with the rear foot.",
  },
  {
    name: "Sumo Squat",
    muscleGroup: "glutes",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Take a wide stance with toes flared and squat holding a dumbbell between your legs. The wide stance increases glute and inner thigh activation.",
  },

  // CALVES
  {
    name: "Seated Calf Raise",
    muscleGroup: "calves",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Sit with knees bent at 90 degrees under the pad and raise up on the balls of your feet. Bent knee position isolates the soleus — use a full range of motion.",
  },
  {
    name: "Standing Calf Raise",
    muscleGroup: "calves",
    equipment: "machine",
    sfr: "medium",
    instructions:
      "Stand on the edge of a platform and raise up on toes to full extension. Lower all the way down for a deep stretch before each rep.",
  },
  {
    name: "Leg Press Calf Raise",
    muscleGroup: "calves",
    equipment: "machine",
    sfr: "medium",
    instructions:
      "With legs extended on the leg press, press the weight through the balls of your feet only. A convenient calf variation when standing raises aren't available.",
  },
  {
    name: "Donkey Calf Raise",
    muscleGroup: "calves",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Lean forward with hips at 90 degrees and raise up onto toes against a loaded pad. The hip position increases stretch on the gastrocnemius for superior development.",
  },
  {
    name: "Single-Leg Calf Raise",
    muscleGroup: "calves",
    equipment: "bodyweight",
    sfr: "high",
    instructions:
      "Balance on one foot on a step and raise all the way up and lower all the way down. Unilateral loading doubles the stimulus per leg compared to bilateral raises.",
  },

  // ABS
  {
    name: "Cable Crunch",
    muscleGroup: "abs",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Kneel at a high cable with the rope behind your head and crunch your elbows toward your knees. Cable provides load through the full crunch range — the best weighted ab exercise.",
  },
  {
    name: "Hanging Leg Raise",
    muscleGroup: "abs",
    equipment: "bodyweight",
    sfr: "high",
    instructions:
      "Hang from a bar and raise your legs to parallel or beyond with a posterior pelvic tilt. Avoid swinging and focus on using the abs rather than hip flexors.",
  },
  {
    name: "Ab Wheel Rollout",
    muscleGroup: "abs",
    equipment: "other",
    sfr: "high",
    instructions:
      "Start on your knees and roll the wheel out until your body is fully extended, then pull back. This creates extreme ab stretch under load for strong hypertrophic stimulus.",
  },
  {
    name: "Decline Crunch",
    muscleGroup: "abs",
    equipment: "bodyweight",
    sfr: "medium",
    instructions:
      "Hook feet under the pads on a decline bench and crunch your torso toward your knees. Add a plate to the chest to increase resistance as bodyweight becomes easy.",
  },
  {
    name: "Plank",
    muscleGroup: "abs",
    equipment: "bodyweight",
    sfr: "medium",
    instructions:
      "Hold a push-up position on forearms with a rigid straight body line. Focus on bracing the entire core rather than just holding your breath.",
  },
  {
    name: "Russian Twist",
    muscleGroup: "abs",
    equipment: "other",
    sfr: "medium",
    instructions:
      "Sit at a 45-degree angle with feet raised and rotate a weight from side to side. This targets the obliques with a rotational demand.",
  },
  {
    name: "Reverse Crunch",
    muscleGroup: "abs",
    equipment: "bodyweight",
    sfr: "high",
    instructions:
      "Lie on your back and curl your hips off the floor toward your chest using only your abs. Keep the movement slow and controlled to avoid momentum.",
  },

  // FOREARMS
  {
    name: "Wrist Curl",
    muscleGroup: "forearms",
    equipment: "barbell",
    sfr: "high",
    instructions:
      "Rest forearms on a bench with hands hanging over the edge and curl the wrist upward. Full range of motion including a deep stretch at the bottom.",
  },
  {
    name: "Reverse Wrist Curl",
    muscleGroup: "forearms",
    equipment: "barbell",
    sfr: "high",
    instructions:
      "Same position as wrist curl but with an overhand grip, extending the wrist upward. This targets the extensor muscles on the back of the forearm.",
  },
  {
    name: "Hammer Curl Forearm Focus",
    muscleGroup: "forearms",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Perform hammer curls with emphasis on slow eccentric to challenge the brachioradialis. Neutral grip places the forearm muscles under significant load.",
  },
  {
    name: "Farmer Carry",
    muscleGroup: "forearms",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Pick up heavy dumbbells and walk for a set distance or time. Excellent for grip strength and forearm hypertrophy with carry-over to all pulling exercises.",
  },

  // CHEST (additional)
  {
    name: "Machine Chest Press",
    muscleGroup: "chest",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Sit at the chest press machine and press the handles to full extension. Machines offer a safe, guided path ideal for high-rep pump work or training to failure.",
  },
  {
    name: "Smith Machine Incline Press",
    muscleGroup: "chest",
    equipment: "machine",
    sfr: "medium",
    instructions:
      "Set bench to 30–45 degrees under the Smith machine and press from upper chest to full lockout. The fixed path lets you push close to failure with reduced spotter risk.",
  },
  {
    name: "Svend Press",
    muscleGroup: "chest",
    equipment: "other",
    sfr: "high",
    instructions:
      "Press two plates together between your palms and press them forward from your chest. The adduction force keeps the pecs under constant tension throughout the range.",
  },

  // BACK (additional)
  {
    name: "Meadows Row",
    muscleGroup: "back",
    equipment: "barbell",
    sfr: "high",
    instructions:
      "Stand perpendicular to a landmine and row the sleeve toward your hip with one hand. The angle creates a unique lat stretch superior to traditional dumbbell rows.",
  },
  {
    name: "Seal Row",
    muscleGroup: "back",
    equipment: "barbell",
    sfr: "high",
    instructions:
      "Lie prone on an elevated bench and row a barbell from a dead hang each rep. Eliminates lower back fatigue and enforces a full range of motion.",
  },
  {
    name: "Cable Pullover",
    muscleGroup: "back",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Stand facing a high cable, grip a bar with straight arms and pull it down in an arc to your thighs. Constant tension from the cable makes this superior to the dumbbell version for lats.",
  },

  // SHOULDERS (additional)
  {
    name: "Landmine Press",
    muscleGroup: "shoulders",
    equipment: "barbell",
    sfr: "high",
    instructions:
      "Cup the end of a landmine barbell and press it from shoulder height upward in a slight arc. The angle reduces shoulder impingement risk compared to a strict overhead press.",
  },
  {
    name: "Plate Front Raise",
    muscleGroup: "shoulders",
    equipment: "other",
    sfr: "medium",
    instructions:
      "Hold a weight plate at nine and three o'clock and raise it to eye level. The wide grip engages the anterior delt while keeping the hands in a comfortable position.",
  },
  {
    name: "Cable Rear Delt Pull",
    muscleGroup: "shoulders",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Use a high cable with a single handle and pull across your body to the rear delt position. Unilateral cable allows a full range of motion for the rear delt.",
  },

  // BICEPS (additional)
  {
    name: "Cable Hammer Curl",
    muscleGroup: "biceps",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Attach a rope to a low cable and curl with a neutral grip. Cable hammer curls maintain tension at the bottom, unlike dumbbell hammer curls.",
  },
  {
    name: "Reverse Curl",
    muscleGroup: "biceps",
    equipment: "barbell",
    sfr: "medium",
    instructions:
      "Curl a barbell with an overhand grip from full extension to chin height. Primarily targets the brachialis and brachioradialis rather than the bicep peak.",
  },

  // TRICEPS (additional)
  {
    name: "Tate Press",
    muscleGroup: "triceps",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Lie flat holding dumbbells above your chest and lower them toward your armpits by flaring the elbows. Press back up through the triceps — excellent medial head exercise.",
  },
  {
    name: "Tricep Kickback",
    muscleGroup: "triceps",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Hinge forward and extend the dumbbell behind you to full arm extension. Peak contraction occurs at full extension — slow the lowering phase for maximum tension.",
  },

  // QUADS (additional)
  {
    name: "Reverse Lunge",
    muscleGroup: "quads",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Step backward into a lunge position and lower the rear knee toward the floor. Easier on the knee than forward lunges with similar quad and glute stimulus.",
  },
  {
    name: "Heel-Elevated Goblet Squat",
    muscleGroup: "quads",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Place heels on small plates and squat holding a dumbbell at the chest. Heel elevation increases knee travel, maximizing quad stretch and VMO recruitment.",
  },

  // HAMSTRINGS (additional)
  {
    name: "Glute-Ham Raise",
    muscleGroup: "hamstrings",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Set up on the GHD machine and lower by extending the knees, then curl back up using the hamstrings. One of the most effective hamstring hypertrophy movements available.",
  },
  {
    name: "Dumbbell Romanian Deadlift",
    muscleGroup: "hamstrings",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Perform a Romanian deadlift holding dumbbells at your sides. Dumbbells can travel outside the legs, allowing a greater range of motion than the barbell version.",
  },

  // GLUTES (additional)
  {
    name: "Banded Hip Thrust",
    muscleGroup: "glutes",
    equipment: "other",
    sfr: "high",
    instructions:
      "Perform a hip thrust with a resistance band across the hips in addition to barbell load. The band accommodates resistance and increases peak contraction intensity.",
  },
  {
    name: "Lateral Band Walk",
    muscleGroup: "glutes",
    equipment: "other",
    sfr: "high",
    instructions:
      "Place a band above the knees and walk sideways with a slight squat. Targets the glute medius for hip abduction strength and stability.",
  },

  // CALVES (additional)
  {
    name: "Tibialis Raise",
    muscleGroup: "calves",
    equipment: "bodyweight",
    sfr: "high",
    instructions:
      "Stand with heels on the floor and raise your toes as high as possible, then lower. Trains the anterior tibialis — important for lower leg balance and knee health.",
  },
  {
    name: "Calf Raise on Leg Press",
    muscleGroup: "calves",
    equipment: "machine",
    sfr: "high",
    instructions:
      "With legs fully extended on the leg press, perform calf raises through the full range of motion with toes pointed slightly inward then outward across sets.",
  },

  // ABS (additional)
  {
    name: "Dragon Flag",
    muscleGroup: "abs",
    equipment: "bodyweight",
    sfr: "high",
    instructions:
      "Lie on a bench and raise your body to a vertical position supported by your upper back, then lower with a rigid body. An advanced full-core exercise with high ab stretch.",
  },
  {
    name: "Pallof Press",
    muscleGroup: "abs",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Stand perpendicular to a cable and press the handle straight out, resisting rotation. An anti-rotation core exercise that builds functional stability.",
  },
  {
    name: "Weighted Sit-Up",
    muscleGroup: "abs",
    equipment: "other",
    sfr: "medium",
    instructions:
      "Perform a full sit-up holding a plate to your chest. Allows progressive overload of the abs over time as bodyweight becomes insufficient.",
  },

  // FOREARMS (additional)
  {
    name: "Plate Pinch",
    muscleGroup: "forearms",
    equipment: "other",
    sfr: "high",
    instructions:
      "Pinch two smooth weight plates together between fingers and thumb and hold for time. Trains the pinch grip muscles of the fingers and thumb extensors.",
  },
  {
    name: "Dead Hang",
    muscleGroup: "forearms",
    equipment: "bodyweight",
    sfr: "high",
    instructions:
      "Hang from a pull-up bar for as long as possible without any kipping. Builds grip endurance and decompresses the spine as a bonus.",
  },

  // LAXMAN PROGRAM SPECIFIC
  {
    name: "Bent Over Lateral Raise",
    muscleGroup: "shoulders",
    equipment: "dumbbell",
    sfr: "high",
    instructions:
      "Hinge forward at the hips until torso is nearly parallel to the floor. With slight elbow bend, raise dumbbells out to the sides targeting the rear delts. Control the descent.",
  },
  {
    name: "Incline DB Front Raise",
    muscleGroup: "shoulders",
    equipment: "dumbbell",
    sfr: "medium",
    instructions:
      "Lie face-down on an incline bench. Raise dumbbells forward and up to shoulder height, keeping arms straight. Trains the anterior deltoid through full range of motion.",
  },
  {
    name: "Machine Shoulder Press",
    muscleGroup: "shoulders",
    equipment: "machine",
    sfr: "high",
    instructions:
      "Sit in the shoulder press machine, grip the handles at shoulder height. Press overhead until arms are nearly extended, then lower with control. Constant tension on the delts throughout.",
  },
  {
    name: "Cable Rotation",
    muscleGroup: "shoulders",
    equipment: "cable",
    sfr: "medium",
    instructions:
      "Stand side-on to a cable set at shoulder height. Rotate the torso away from the cable keeping arms extended. Trains the rotator cuff and shoulder stability muscles.",
  },
  {
    name: "Reverse Grip Pulldown",
    muscleGroup: "back",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Sit at a lat pulldown station and grip the bar with an underhand (supinated) grip, hands shoulder-width. Pull the bar to your upper chest leading with elbows, squeezing lats at the bottom.",
  },
  {
    name: "V Bar Pulldown",
    muscleGroup: "back",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Attach a V-bar to the lat pulldown cable. Grip with a neutral (palms-facing) grip and pull to your upper chest. Neutral grip allows a strong lat contraction and is easier on the elbows.",
  },
  {
    name: "Reverse Grip Pushdown",
    muscleGroup: "triceps",
    equipment: "cable",
    sfr: "high",
    instructions:
      "Attach a straight bar to a high cable. Grip with an underhand (supinated) grip, elbows tucked to sides. Push the bar down to full extension targeting the long head of the tricep.",
  },
];

export const seedExercises = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if exercises already exist
    const existing = await ctx.db.query("exercises").collect();
    if (existing.length > 0) {
      return { seeded: false, count: 0 };
    }

    // Insert all seed exercises
    for (const exercise of EXERCISE_SEED_DATA) {
      await ctx.db.insert("exercises", {
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        sfr: exercise.sfr,
        instructions: exercise.instructions,
        isCustom: false,
      });
    }

    return { seeded: true, count: EXERCISE_SEED_DATA.length };
  },
});

// Upserts any exercises from EXERCISE_SEED_DATA that don't yet exist in the DB.
// Safe to call at any time — skips exercises that already exist by name.
export const seedMissingExercises = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("exercises").collect();
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

    let added = 0;
    for (const exercise of EXERCISE_SEED_DATA) {
      if (!existingNames.has(exercise.name.toLowerCase())) {
        await ctx.db.insert("exercises", {
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
          sfr: exercise.sfr,
          instructions: exercise.instructions,
          isCustom: false,
        });
        added++;
      }
    }

    return { added, total: existing.length + added };
  },
});
