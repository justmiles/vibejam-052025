{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_20  # Includes npm
    pkgs.go
  ];

  shellHook = ''
    echo "Nix environment loaded."
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
    echo "Go version: $(go version)"
  '';
}