const MASTER_PLAN_FIRST_FRAME_URL =
  "https://cdn.sthyra.com/TULA/Videos/360final2LAST2_GOP3_HQ_first_frame.avif";

export default function MasterPlanLoading() {
  return (
    <section className="relative app-screen w-full overflow-hidden bg-black">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('${MASTER_PLAN_FIRST_FRAME_URL}')`,
        }}
      />
    </section>
  );
}
