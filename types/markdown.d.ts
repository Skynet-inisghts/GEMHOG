// docs/*.md files are bundled as raw strings (next.config.ts webpack rule).
declare module "*.md" {
  const content: string;
  export default content;
}
