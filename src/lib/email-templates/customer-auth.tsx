/* eslint-disable react-refresh/only-export-components -- Server-rendered email template registry. */
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
} from "@react-email/components";

function CustomerAuthEmail({ purpose = "verify", url = "" }: { purpose?: string; url?: string }) {
  const verify = purpose === "verify";
  if (purpose === "changed")
    return (
      <Html>
        <Head />
        <Preview>Your Resolut password was changed</Preview>
        <Body>
          <Container>
            <Heading>Your password was changed</Heading>
            <Text>
              Your Resolut password was changed and previous sessions were signed out. If this was
              you, no action is needed.
            </Text>
            <Text>
              If you did not make this change, reset your password immediately using the link below.
            </Text>
            <Button href={url}>Secure your account</Button>
            <Text>Resolut</Text>
          </Container>
        </Body>
      </Html>
    );
  return (
    <Html>
      <Head />
      <Preview>
        {verify ? "Verify your Resolut email address" : "Reset your Resolut password"}
      </Preview>
      <Body style={{ backgroundColor: "#f5f3ee", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ padding: "32px", backgroundColor: "#ffffff" }}>
          <Heading>{verify ? "Verify your email" : "Reset your password"}</Heading>
          <Text>
            {verify
              ? "Confirm your email to finish creating your Resolut account. You will need the password you chose when signing up. This link expires in 24 hours."
              : "Use the link below to choose a new password. This link expires in one hour and can only be used once."}
          </Text>
          <Button
            href={url}
            style={{ backgroundColor: "#263328", color: "#ffffff", padding: "14px 24px" }}
          >
            {verify ? "Verify email" : "Reset password"}
          </Button>
          <Text>If you did not request this, ignore this email. Do not share this link.</Text>
          <Text>Resolut</Text>
        </Container>
      </Body>
    </Html>
  );
}
export const template = {
  component: CustomerAuthEmail,
  subject: (data: Record<string, unknown>) =>
    data.purpose === "changed"
      ? "Your Resolut password was changed"
      : data.purpose === "verify"
        ? "Verify your Resolut email"
        : "Reset your Resolut password",
};
