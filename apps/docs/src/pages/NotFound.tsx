import { Md, PageHeader } from "../components/doc";

export function NotFound() {
  return (
    <>
      <PageHeader eyebrow="404" title="Nothing set here" lede="This page doesn't exist, or it moved." />
      <Md>{`Try [Getting started](/docs/getting-started), the [examples](/examples), or the [API reference](/docs/api/react).`}</Md>
    </>
  );
}
