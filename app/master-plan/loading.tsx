import { signR2AssetKey } from "@/lib/server/r2-signed-assets";

export default function MasterPlanLoading() {
  const overviewFrameUrl = signR2AssetKey("images/first_frame_overview.jpg");

  return (
    <section className="relative app-screen w-full overflow-hidden bg-[#1f1a12]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('${overviewFrameUrl}')`,
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(18,14,9,0.20))]" />
    </section>
  );
}
