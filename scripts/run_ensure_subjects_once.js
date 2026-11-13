// Run ensureSubjectsPerClass once to split any existing multi-class docs, then exit
const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  subjectCode: { type: String, default: '', trim: true },
  teacher: { type: String, default: '', trim: true },
  assignedClasses: { type: [String], default: [] },
  order: { type: Number, default: 0 },
  isPrivate: { type: Boolean, default: false },
  ownerEmail: { type: String, default: '', trim: true, lowercase: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  ownerName: { type: String, default: '', trim: true },
  createdAt: { type: Date, default: Date.now }
});
const Subject = mongoose.model('Subject', subjectSchema);

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/registerly_db');
  console.log('Connected to MongoDB');

  const multiSubjects = await Subject.find({
    $expr: { $gt: [{ $size: { $ifNull: ['$assignedClasses', []] } }, 1] }
  });

  console.log(`Found ${multiSubjects.length} multi-class subject docs to split`);

  for (const sub of multiSubjects) {
    const classes = sub.assignedClasses || [];
    if (classes.length <= 1) continue;

    const firstClass = classes[0];
    const otherClasses = classes.slice(1);

    sub.assignedClasses = [firstClass];
    await sub.save();
    console.log(`  Updated "${sub.name}" → kept class: ${firstClass}`);

    for (const cls of otherClasses) {
      const existing = await Subject.findOne({
        name: sub.name,
        assignedClasses: cls,
        isPrivate: sub.isPrivate,
        ...(sub.isPrivate ? { ownerEmail: sub.ownerEmail } : {})
      });
      if (!existing) {
        await Subject.create({
          name: sub.name,
          subjectCode: sub.subjectCode,
          teacher: sub.teacher,
          assignedClasses: [cls],
          order: sub.order || 0,
          isPrivate: Boolean(sub.isPrivate),
          ownerEmail: sub.isPrivate ? sub.ownerEmail : '',
          ownerId: sub.isPrivate ? sub.ownerId : null,
          ownerName: sub.isPrivate ? sub.ownerName : ''
        });
        console.log(`  Created new doc for "${sub.name}" → class: ${cls}`);
      } else {
        console.log(`  Skipped "${sub.name}" → class: ${cls} (already exists)`);
      }
    }
  }

  // Verify — no multi-class docs should remain
  const remaining = await Subject.find({
    $expr: { $gt: [{ $size: { $ifNull: ['$assignedClasses', []] } }, 1] }
  });
  console.log(`\nVerification: ${remaining.length} multi-class docs remaining (should be 0)`);
  if (remaining.length > 0) {
    console.error('WARNING: Some multi-class docs still exist!');
    remaining.forEach(s => console.log('  ', s.name, s.assignedClasses));
  } else {
    console.log('✅ Migration complete — all subject docs have exactly 0 or 1 class');
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
