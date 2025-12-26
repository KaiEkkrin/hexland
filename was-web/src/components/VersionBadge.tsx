import './VersionBadge.css';
import packageJson from '../../package.json';

function VersionBadge() {
  const versionString = `v${packageJson.version}+${__GIT_COMMIT__}`;

  return (
    <a
      href="https://github.com/KaiEkkrin/wallandshadow"
      className="version-badge"
      target="_blank"
      rel="noopener noreferrer"
      title="View on GitHub"
    >
      {versionString}
    </a>
  );
}

export default VersionBadge;
