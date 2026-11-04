"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import {
  BusinessProfileInputSchema,
  formatLinkLines,
  parseLines,
  parseLinkLines,
  type BusinessProfileInput,
} from "@/lib/schemas/business-profile";
import { updateBusinessProfile } from "@/server/actions/admin";
import { useAdminAction } from "./use-admin-action";

const legendClasses =
  "mb-4 text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase";

export function BusinessProfileForm({
  profile,
}: {
  profile: BusinessProfileInput;
}) {
  const [businessName, setBusinessName] = useState(profile.business_name);
  const [industry, setIndustry] = useState(profile.industry);
  const [description, setDescription] = useState(profile.business_description);
  const [audience, setAudience] = useState(profile.audience_description);
  const [offeringsLabel, setOfferingsLabel] = useState(profile.offerings_label);
  const [offerings, setOfferings] = useState(profile.offerings.join("\n"));
  const [offers, setOffers] = useState(profile.current_offers ?? "");
  const [tipTopic, setTipTopic] = useState(profile.tip_topic);
  const [doList, setDoList] = useState(profile.do_list.join("\n"));
  const [dontList, setDontList] = useState(profile.dont_list.join("\n"));
  const [links, setLinks] = useState(formatLinkLines(profile.links));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const { pending, error, fields, run } = useAdminAction();
  const errors = { ...fields, ...localErrors };

  const draft: BusinessProfileInput = {
    business_name: businessName,
    industry,
    business_description: description,
    audience_description: audience,
    offerings_label: offeringsLabel,
    offerings: parseLines(offerings),
    current_offers: offers,
    tip_topic: tipTopic,
    do_list: parseLines(doList),
    dont_list: parseLines(dontList),
    links: parseLinkLines(links),
  };
  const hasChanges =
    JSON.stringify(
      BusinessProfileInputSchema.safeParse(draft).data ?? draft,
    ) !==
    JSON.stringify(
      BusinessProfileInputSchema.safeParse(profile).data ?? profile,
    );
  const offeringsName = offeringsLabel.trim() || "Offerings";

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = BusinessProfileInputSchema.safeParse(draft);
    if (!parsed.success) {
      const messages: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "input");
        messages[field] ??= issue.message;
      }
      setLocalErrors(messages);
      return;
    }
    setLocalErrors({});
    run(
      () => updateBusinessProfile(draft),
      () => "Business profile saved. New generations use it.",
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <fieldset className="space-y-6" disabled={pending}>
        <legend className={legendClasses}>Business</legend>
        <Input
          label="Business name"
          value={businessName}
          maxLength={120}
          error={errors.business_name}
          onChange={(event) => setBusinessName(event.target.value)}
        />
        <Input
          label="Industry"
          value={industry}
          maxLength={120}
          placeholder="Python training"
          error={errors.industry}
          helper="A few words. Every plan and post stays within it."
          onChange={(event) => setIndustry(event.target.value)}
        />
        <Textarea
          label="What the business does"
          value={description}
          maxLength={2000}
          error={errors.business_description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Textarea
          label="Audience"
          value={audience}
          maxLength={2000}
          error={errors.audience_description}
          helper="Who the content is for and what they care about."
          onChange={(event) => setAudience(event.target.value)}
        />
      </fieldset>
      <fieldset className="space-y-6" disabled={pending}>
        <legend className={legendClasses}>What you offer</legend>
        <Input
          label="Name for what you offer"
          value={offeringsLabel}
          maxLength={30}
          placeholder="Courses"
          error={errors.offerings_label}
          helper="For example Courses, Services, Products or Programs."
          onChange={(event) => setOfferingsLabel(event.target.value)}
        />
        <Textarea
          label={offeringsName}
          value={offerings}
          error={errors.offerings}
          helper="One per line, up to 40. Generated content never invents others."
          onChange={(event) => setOfferings(event.target.value)}
        />
        <Textarea
          label="Current offers"
          value={offers}
          maxLength={2000}
          error={errors.current_offers}
          helper="Optional. Leave empty rather than keep an expired offer."
          onChange={(event) => setOffers(event.target.value)}
        />
      </fieldset>
      <fieldset className="space-y-6" disabled={pending}>
        <legend className={legendClasses}>Guidance</legend>
        <Input
          label="Daily tip topic"
          value={tipTopic}
          maxLength={200}
          placeholder="Python programming"
          error={errors.tip_topic}
          helper="The subject of the internal tip of the day."
          onChange={(event) => setTipTopic(event.target.value)}
        />
        <Textarea
          label="Always"
          value={doList}
          error={errors.do_list}
          helper="One rule per line, up to 40."
          onChange={(event) => setDoList(event.target.value)}
        />
        <Textarea
          label="Never"
          value={dontList}
          error={errors.dont_list}
          helper="One rule per line, up to 40."
          onChange={(event) => setDontList(event.target.value)}
        />
        <Textarea
          label="Links"
          value={links}
          error={errors.links}
          placeholder="Website: https://example.com"
          helper="One per line as Name: https://address, up to 20."
          onChange={(event) => setLinks(event.target.value)}
        />
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={pending} disabled={!hasChanges}>
        Save business profile
      </Button>
    </form>
  );
}
