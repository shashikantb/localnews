
import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck } from 'lucide-react';

const PrivacyPolicyPage: NextPage = () => {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-3xl space-y-8 py-8">
        <Card className="shadow-xl border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4 pt-6 px-6 bg-gradient-to-br from-card to-muted/10 rounded-t-xl">
            <CardTitle className="text-3xl font-bold text-primary flex items-center">
              <ShieldCheck className="w-8 h-8 mr-3 text-accent" />
              Privacy Policy for LocalPulse
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
              <div className="space-y-6 text-foreground/90">
                <p className="text-sm text-muted-foreground">
                  Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">1. Introduction</h2>
                  <p>
                    Welcome to LocalPulse (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you use our mobile application and services (collectively, the &quot;Service&quot;).
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">2. Information We Collect</h2>
                  <p>We may collect and process the following types of information:</p>
                  <div className="space-y-1 pl-4">
                    <h3 className="text-lg font-medium text-foreground/80">a. Location Data</h3>
                    <p>We collect:</p>
                    <ul className="list-disc list-inside space-y-1 pl-4">
                      <li>
                        Precise location (via GPS, Wi-Fi, and cellular networks) to show relevant content based on your area.
                      </li>
                      <li>
                        Background location (when enabled) to deliver real-time localized updates even when the app is not in the foreground.
                      </li>
                    </ul>
                    <h3 className="text-lg font-medium text-foreground/80 mt-2">b. Device and Log Information</h3>
                    <ul className="list-disc list-inside space-y-1 pl-4">
                      <li>
                        Device model, operating system version, unique identifiers, IP address, and network status.
                      </li>
                    </ul>
                    <h3 className="text-lg font-medium text-foreground/80 mt-2">c. Usage Information</h3>
                     <ul className="list-disc list-inside space-y-1 pl-4">
                      <li>
                        Pages visited, in-app behaviors, and interaction logs (e.g., WebView activity).
                      </li>
                    </ul>
                    <h3 className="text-lg font-medium text-foreground/80 mt-2">d. Push Notification Tokens</h3>
                    <ul className="list-disc list-inside space-y-1 pl-4">
                       <li>
                        We collect device tokens via Firebase Cloud Messaging (FCM) to send you location-specific alerts and updates.
                      </li>
                    </ul>
                  </div>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">3. How We Use Your Information</h2>
                  <p>We use the information we collect to:</p>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>Provide and personalize our services.</li>
                    <li>Send you notifications about relevant local events or user activities.</li>
                    <li>Improve app performance, security, and user experience.</li>
                    <li>Monitor and debug issues via analytics and crash reports.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">4. Sharing Your Information</h2>
                  <p>We do not sell your personal data. We may share limited data:</p>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>
                      With service providers (e.g., Firebase by Google) for analytics and push notifications.
                    </li>
                    <li>
                      When required by law or to protect user safety or security.
                    </li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">5. Data Retention</h2>
                  <p>
                    We retain your data as long as necessary to provide the Service or as required by law. You may request deletion of your data at any time by contacting us.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">6. Security</h2>
                  <p>
                    We implement standard security measures (such as HTTPS encryption and secure storage) to protect your personal data.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">7. Your Rights and Choices</h2>
                  <p>Depending on your jurisdiction, you may have rights to:</p>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>Access and correct your data.</li>
                    <li>Request deletion of your data.</li>
                    <li>Opt-out of notifications (via device settings).</li>
                    <li>Withdraw consent for location tracking.</li>
                  </ul>
                </section>

                <p className="font-bold text-lg text-destructive pt-4 border-t mt-6">
                  Note: This privacy policy provides a general overview. For specific details relevant to your usage and jurisdiction, please review the full legal documentation or contact support.
                </p>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default PrivacyPolicyPage;
