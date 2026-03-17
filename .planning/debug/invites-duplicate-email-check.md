---
status: diagnosed
trigger: "POST /api/invites allows creating invites for emails that already belong to existing users"
created: 2026-03-17T00:00:00Z
updated: 2026-03-17T00:00:00Z
---

## Current Focus

hypothesis: The POST /api/invites handler inserts the invite row without first querying the users table to check whether the email is already registered, making the duplicate-user guard completely absent.
test: Read route.ts line by line to trace every database call between validation and insert.
expecting: No SELECT against the users table by email exists before the INSERT into invites.
next_action: DONE — root cause confirmed.

## Symptoms

expected: Coaches cannot invite an email address that already belongs to an existing user account.
actual: The invite is created successfully even when the email is already in the users table.
errors: No error is surfaced to the user or logged; the invite insert succeeds with status 201.
reproduction: As a coach, POST /api/invites with { "email": "<email of existing user>" } — receives 201 with an invite link.
started: Unknown; the check was never implemented.

## Eliminated

- hypothesis: The invites table has a unique constraint on email that would block the insert at the DB layer.
  evidence: The route catches the DB error and returns it, so if a constraint existed the insert would fail — but the issue report confirms it succeeds. No constraint visible in the route code.
  timestamp: 2026-03-17T00:00:00Z

- hypothesis: The admin client or RLS might filter or block the insert for existing users.
  evidence: admin.ts uses the service role key which bypasses RLS entirely, so no policy can protect this path.
  timestamp: 2026-03-17T00:00:00Z

## Evidence

- timestamp: 2026-03-17T00:00:00Z
  checked: src/app/api/invites/route.ts — full file
  found: After role check (line 29) and schema validation (line 40-46), the handler immediately generates a code and calls admin.from("invites").insert() at line 53. There is no SELECT against the users table by email anywhere in the file.
  implication: The missing validation step is the absence of a query like `admin.from("users").select("id").eq("email", parsed.data.email).maybeSingle()` before the insert.

- timestamp: 2026-03-17T00:00:00Z
  checked: src/lib/supabase/admin.ts
  found: createAdminClient() uses the service role key and bypasses RLS. The tool is capable of querying users by email; the route simply never calls it for that purpose.
  implication: The fix is entirely in route.ts — admin client is correctly set up and usable.

## Resolution

root_cause: |
  In src/app/api/invites/route.ts, the POST handler performs auth, role, and schema validation but then proceeds directly to the invite INSERT (line 53) with no prior check against the users table.
  The guard "email must not belong to an existing user" is simply not implemented — there is no SELECT query on the users table for the submitted email before the insert.

fix: |
  After the schema validation block (after line 46) and before generating the invite code, add:

    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("email", parsed.data.email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email is already registered." },
        { status: 409 }
      );
    }

  This queries the public users table (not auth.users) using the already-available admin client, and returns 409 Conflict before any code is generated or any row is inserted.

verification: []
files_changed: []
