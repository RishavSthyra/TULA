import { MASTER_PLAN_ORBIT_FALLBACK_IMAGE_URL } from "@/lib/master-plan-asset-keys";

export default function MasterPlanLoading() {
  return (
    <section className="relative app-screen w-full overflow-hidden bg-black">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('${MASTER_PLAN_ORBIT_FALLBACK_IMAGE_URL}')`,
        }}
      />
    </section>
  );
}
