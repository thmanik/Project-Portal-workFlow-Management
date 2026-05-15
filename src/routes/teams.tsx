import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Mail, Plus, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { type Member, usePortal } from "@/lib/portal-data";

export const Route = createFileRoute("/teams")({
  component: TeamsPage,
  head: () => ({
    meta: [{ title: "Teams & Members — Project Portal" }],
  }),
});

type TeamForm = {
  name: string;
  companyId: string;
  divisionId: string;
  leadMemberId: string;
};

type MemberForm = {
  name: string;
  email: string;
  companyId: string;
  divisionId: string;
  teamId: string;
  roleTitle: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getDivisionRoleOptions(divisionName?: string, divisionAbbr?: string) {
  const label = `${divisionName || ""} ${divisionAbbr || ""}`.toLowerCase();

  if (label.includes("tms") && label.includes("eng")) {
    return ["TMS Manager", "TMS-M1 Drawing Member", "TMS-M2 Checking Member", "TMS-M3 Approval Member"];
  }

  if (label.includes("tms") && label.includes("it")) {
    return ["TMS-IT Team Leader", "TMS-IT Member"];
  }

  if (label.includes("ccr")) {
    return ["Prime Consultant", "CCR Coordinator", "CCR Member"];
  }

  if (label.includes("ecm")) {
    return ["ECM Team Leader", "ECM Member"];
  }

  if (label.includes("pmo")) {
    return ["PMO Team Leader", "PMO Member"];
  }

  return ["Team Leader", "Team Member", "Specialist"];
}

function sortMembersByLead(members: Member[], leadMemberId?: string) {
  return [...members].sort((a, b) => {
    if (a.id === leadMemberId) return -1;
    if (b.id === leadMemberId) return 1;
    return a.name.localeCompare(b.name);
  });
}

function TeamsPage() {
  const { state, currentActor, addTeam, addMember } = usePortal();
  const canManage = ["system_admin", "prime_consultant"].includes(currentActor.role);

  const firstCompanyId = state.companies[0]?.id || "";
  const firstDivisionId = state.divisions.find((division) => division.companyId === firstCompanyId)?.id || state.divisions[0]?.id || "";
  const firstDivision = state.divisions.find((division) => division.id === firstDivisionId);
  const firstRoleTitle = getDivisionRoleOptions(firstDivision?.name, firstDivision?.abbr)[0] || "";

  const [search, setSearch] = useState("");
  const [showTeam, setShowTeam] = useState(false);
  const [showMember, setShowMember] = useState(false);

  const [teamForm, setTeamForm] = useState<TeamForm>({
    name: "",
    companyId: firstCompanyId,
    divisionId: firstDivisionId,
    leadMemberId: "",
  });

  const [memberForm, setMemberForm] = useState<MemberForm>({
    name: "",
    email: "",
    companyId: firstCompanyId,
    divisionId: firstDivisionId,
    teamId: "",
    roleTitle: firstRoleTitle,
  });

  const assignedMemberIds = useMemo(() => new Set(state.teams.flatMap((team) => team.memberIds)), [state.teams]);

  const visibleTeams = useMemo(() => {
    const q = normalize(search);

    return state.teams.filter((team) => {
      const company = state.companies.find((item) => item.id === team.companyId);
      const division = state.divisions.find((item) => item.id === team.divisionId);
      const teamMembers = state.members.filter((member) => team.memberIds.includes(member.id));
      const lead = state.members.find((member) => member.id === team.leadMemberId);

      const searchableText = [
        team.name,
        company?.name,
        company?.abbr,
        division?.name,
        division?.abbr,
        lead?.name,
        ...teamMembers.flatMap((member) => [member.name, member.email, member.roleTitle]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !q || searchableText.includes(q);
    });
  }, [search, state.companies, state.divisions, state.members, state.teams]);

  const unassignedMembers = useMemo(() => {
    const q = normalize(search);

    return state.members.filter((member) => {
      if (assignedMemberIds.has(member.id)) return false;

      const company = state.companies.find((item) => item.id === member.companyId);
      const division = state.divisions.find((item) => item.id === member.divisionId);

      const searchableText = [member.name, member.email, member.roleTitle, company?.name, company?.abbr, division?.name, division?.abbr]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !q || searchableText.includes(q);
    });
  }, [assignedMemberIds, search, state.companies, state.divisions, state.members]);

  const teamCompanyDivisions = useMemo(
    () => state.divisions.filter((division) => division.companyId === teamForm.companyId),
    [state.divisions, teamForm.companyId]
  );

  const memberCompanyDivisions = useMemo(
    () => state.divisions.filter((division) => division.companyId === memberForm.companyId),
    [state.divisions, memberForm.companyId]
  );

  const teamLeadOptions = useMemo(
    () =>
      state.members.filter((member) => {
        if (!member.active) return false;
        if (member.companyId !== teamForm.companyId) return false;
        if (member.divisionId !== teamForm.divisionId) return false;

        const alreadyAssignedToAnotherTeam = state.teams.some((team) => team.memberIds.includes(member.id));
        return !alreadyAssignedToAnotherTeam;
      }),
    [state.members, state.teams, teamForm.companyId, teamForm.divisionId]
  );

  const memberTeamOptions = useMemo(
    () => state.teams.filter((team) => team.companyId === memberForm.companyId && team.divisionId === memberForm.divisionId),
    [memberForm.companyId, memberForm.divisionId, state.teams]
  );

  const selectedMemberDivision = state.divisions.find((division) => division.id === memberForm.divisionId);
  const memberRoleOptions = getDivisionRoleOptions(selectedMemberDivision?.name, selectedMemberDivision?.abbr);

  const resetTeamForm = () => {
    setTeamForm({
      name: "",
      companyId: firstCompanyId,
      divisionId: firstDivisionId,
      leadMemberId: "",
    });
  };

  const resetMemberForm = () => {
    setMemberForm({
      name: "",
      email: "",
      companyId: firstCompanyId,
      divisionId: firstDivisionId,
      teamId: "",
      roleTitle: firstRoleTitle,
    });
  };

  const handleTeamCompanyChange = (companyId: string) => {
    const nextDivisionId = state.divisions.find((division) => division.companyId === companyId)?.id || "";

    setTeamForm((prev) => ({
      ...prev,
      companyId,
      divisionId: nextDivisionId,
      leadMemberId: "",
    }));
  };

  const handleTeamDivisionChange = (divisionId: string) => {
    setTeamForm((prev) => ({
      ...prev,
      divisionId,
      leadMemberId: "",
    }));
  };

  const handleMemberCompanyChange = (companyId: string) => {
    const nextDivision = state.divisions.find((division) => division.companyId === companyId);
    const nextRoleTitle = getDivisionRoleOptions(nextDivision?.name, nextDivision?.abbr)[0] || "";

    setMemberForm((prev) => ({
      ...prev,
      companyId,
      divisionId: nextDivision?.id || "",
      teamId: "",
      roleTitle: nextRoleTitle,
    }));
  };

  const handleMemberDivisionChange = (divisionId: string) => {
    const nextDivision = state.divisions.find((division) => division.id === divisionId);
    const nextRoleTitle = getDivisionRoleOptions(nextDivision?.name, nextDivision?.abbr)[0] || "";

    setMemberForm((prev) => ({
      ...prev,
      divisionId,
      teamId: "",
      roleTitle: nextRoleTitle,
    }));
  };

  const handleCreateTeam = () => {
    const name = teamForm.name.trim();

    if (!name) {
      toast.error("Team name is required");
      return;
    }

    if (!teamForm.companyId || !teamForm.divisionId) {
      toast.error("Company and division are required");
      return;
    }

    const duplicateTeam = state.teams.some(
      (team) => normalize(team.name) === normalize(name) && team.companyId === teamForm.companyId && team.divisionId === teamForm.divisionId
    );

    if (duplicateTeam) {
      toast.error("A team with this name already exists in this division");
      return;
    }

    addTeam({
      name,
      companyId: teamForm.companyId,
      divisionId: teamForm.divisionId,
      leadMemberId: teamForm.leadMemberId || undefined,
    });

    toast.success("Team created");
    setShowTeam(false);
    resetTeamForm();
  };

  const handleAddMember = () => {
    const name = memberForm.name.trim();
    const email = memberForm.email.trim().toLowerCase();
    const roleTitle = memberForm.roleTitle.trim();

    if (!name || !email) {
      toast.error("Name and email are required");
      return;
    }

    if (!emailPattern.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }

    if (!memberForm.companyId || !memberForm.divisionId) {
      toast.error("Company and division are required");
      return;
    }

    if (!roleTitle) {
      toast.error("Role title is required");
      return;
    }

    const duplicateEmail = state.members.some((member) => normalize(member.email) === normalize(email));

    if (duplicateEmail) {
      toast.error("A member with this email already exists");
      return;
    }

    addMember({
      name,
      email,
      companyId: memberForm.companyId,
      divisionId: memberForm.divisionId,
      teamId: memberForm.teamId || undefined,
      roleTitle,
    });

    toast.success("Member added");
    setShowMember(false);
    resetMemberForm();
  };

  const renderMemberRow = (member: Member, leadMemberId?: string) => {
    const isLead = member.id === leadMemberId;

    return (
      <div key={member.id} className="flex flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-card-foreground">{member.name}</p>

            {isLead ? (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Lead
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{member.roleTitle}</span>
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {member.email}
            </span>
          </div>
        </div>

        <span className={`inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-medium ${member.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {member.active ? "Active" : "Inactive"}
        </span>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Teams & Members"
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowMember(true)}>
                <UserPlus className="h-4 w-4" />
                Add Member
              </Button>

              <Button onClick={() => setShowTeam(true)}>
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search teams or members..."
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-md border border-border bg-card px-3 py-1">
            {state.teams.length} Teams
          </span>
          <span className="rounded-md border border-border bg-card px-3 py-1">
            {state.members.filter((member) => member.active).length} Active Members
          </span>
          <span className="rounded-md border border-border bg-card px-3 py-1">
            {unassignedMembers.length} Unassigned
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {visibleTeams.map((team) => {
          const company = state.companies.find((item) => item.id === team.companyId);
          const division = state.divisions.find((item) => item.id === team.divisionId);
          const members = sortMembersByLead(
            state.members.filter((member) => team.memberIds.includes(member.id)),
            team.leadMemberId
          );
          const lead = state.members.find((member) => member.id === team.leadMemberId);

          return (
            <div key={team.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border bg-muted/30 px-5 py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{team.name}</h3>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {company?.abbr || "Unknown Company"}
                      </span>
                      <span>{division?.abbr || "Unknown Division"}</span>
                      <span>Lead: {lead?.name || "Not set"}</span>
                    </div>
                  </div>

                  <span className="inline-flex w-fit items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                    <Users className="h-3 w-3" />
                    {members.length} Member{members.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-border">
                {members.length ? (
                  members.map((member) => renderMemberRow(member, team.leadMemberId))
                ) : (
                  <div className="px-5 py-6 text-center text-sm text-muted-foreground">No members yet.</div>
                )}
              </div>
            </div>
          );
        })}

        {unassignedMembers.length ? (
          <div className="overflow-hidden rounded-xl border border-dashed border-border bg-card">
            <div className="border-b border-border bg-muted/20 px-5 py-4">
              <h3 className="text-sm font-semibold text-card-foreground">Unassigned Members</h3>
            </div>

            <div className="divide-y divide-border">
              {unassignedMembers.map((member) => {
                const company = state.companies.find((item) => item.id === member.companyId);
                const division = state.divisions.find((item) => item.id === member.divisionId);

                return (
                  <div key={member.id} className="flex flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-card-foreground">{member.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{member.roleTitle}</span>
                        <span>{company?.abbr || "Unknown Company"}</span>
                        <span>{division?.abbr || "Unknown Division"}</span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.email}
                        </span>
                      </div>
                    </div>

                    <span className={`inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-medium ${member.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {member.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {!visibleTeams.length && !unassignedMembers.length ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            No teams or members found.
          </div>
        ) : null}
      </div>

      <Dialog
        open={showTeam}
        onOpenChange={(open) => {
          setShowTeam(open);
          if (!open) resetTeamForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Team Name</label>
              <input
                value={teamForm.name}
                onChange={(event) => setTeamForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Example: PMO Team"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Company</label>
              <select
                value={teamForm.companyId}
                onChange={(event) => handleTeamCompanyChange(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {state.companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Division</label>
              <select
                value={teamForm.divisionId}
                onChange={(event) => handleTeamDivisionChange(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {teamCompanyDivisions.length ? (
                  teamCompanyDivisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))
                ) : (
                  <option value="">No division available</option>
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Lead Member</label>
              <select
                value={teamForm.leadMemberId}
                onChange={(event) => setTeamForm((prev) => ({ ...prev, leadMemberId: event.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No lead selected</option>
                {teamLeadOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {member.roleTitle}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTeam(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTeam}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showMember}
        onOpenChange={(open) => {
          setShowMember(open);
          if (!open) resetMemberForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <input
                value={memberForm.name}
                onChange={(event) => setMemberForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Member name"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                value={memberForm.email}
                onChange={(event) => setMemberForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="member@example.com"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Company</label>
              <select
                value={memberForm.companyId}
                onChange={(event) => handleMemberCompanyChange(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {state.companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Division</label>
              <select
                value={memberForm.divisionId}
                onChange={(event) => handleMemberDivisionChange(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {memberCompanyDivisions.length ? (
                  memberCompanyDivisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))
                ) : (
                  <option value="">No division available</option>
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Role Title</label>
              <select
                value={memberForm.roleTitle}
                onChange={(event) => setMemberForm((prev) => ({ ...prev, roleTitle: event.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {memberRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Team</label>
              <select
                value={memberForm.teamId}
                onChange={(event) => setMemberForm((prev) => ({ ...prev, teamId: event.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No team</option>
                {memberTeamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMember(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
