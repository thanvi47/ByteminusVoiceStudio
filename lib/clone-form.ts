// Keep feedback visible before submission, including the reason a reference cannot save.
export function cloneFormIssues(input: {
  hasAudio: boolean; validRange: boolean; name: string; transcript: string; consent: boolean;
}) {
  const issues: string[] = [];
  if (!input.hasAudio) issues.push("প্রথমে নিজের MP3 বা WAV অডিও দিন। Upload your recording first.");
  else if (!input.validRange) issues.push("রেকর্ডিংয়ের মধ্যে ৩–১০ সেকেন্ড বেছে নিন। Select a 3–10 second clip.");
  if (!input.name.trim()) issues.push("ভয়েসের একটি নাম দিন। Enter a voice name.");
  if (input.transcript.trim().length < 2)
    issues.push("নির্বাচিত অংশে যা বলেছেন, সেই পুরো কথাগুলো লিখুন অথবা Auto transcribe চাপুন। শুধু ‘a’ দিলে হবে না।");
  if (!input.consent) issues.push("কণ্ঠটি আপনার বা ব্যবহারের অনুমতি আছে—এই ঘরে টিক দিন। Confirm voice permission.");
  return issues;
}
