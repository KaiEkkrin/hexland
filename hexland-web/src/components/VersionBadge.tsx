import './VersionBadge.css';
import packageJson from '../../package.json';

function VersionBadge() {
  return (
    <a
      href="https://github.com/KaiEkkrin/hexland"
      className="version-badge"
      target="_blank"
      rel="noopener noreferrer"
      title="View on GitHub"
    >
      v{packageJson.version}
    </a>
  );
}

export default VersionBadge;
