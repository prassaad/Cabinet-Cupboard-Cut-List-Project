<?php

declare(strict_types=1);

namespace Standscale\Products\WallView\Controller;

use Standscale\Http\HttpException;
use Standscale\Http\Request;
use Standscale\Http\Response;
use Standscale\Security\TenantContext;
use Standscale\Products\WallView\Repository\ProjectRepository;

/**
 * CRUD for per-tenant design documents (ARCH-004 §4.3). All routes sit behind
 * auth + tenant middleware, and the repository is tenant-scoped, so isolation
 * is enforced in two places.
 */
final class ProjectController
{
    private const MAX_DESIGN_BYTES = 1048576; // 1 MB payload cap (ARCH-004 §4.6)

    private ProjectRepository $projects;
    private TenantContext $context;

    public function __construct(ProjectRepository $projects, TenantContext $context)
    {
        $this->projects = $projects;
        $this->context = $context;
    }

    public function index(Request $r): Response
    {
        return Response::json(['projects' => $this->projects->listMeta()]);
    }

    public function show(Request $r): Response
    {
        $p = $this->projects->find((string) $r->param('id'));
        if ($p === null) {
            throw HttpException::notFound('Project not found.');
        }
        return Response::json($p);
    }

    public function create(Request $r): Response
    {
        [$name, $designJson] = $this->validate($r);
        $id = $this->projects->create($name, $designJson, $this->context->userId());
        return Response::json(['id' => $id, 'name' => $name], 201);
    }

    public function update(Request $r): Response
    {
        [$name, $designJson] = $this->validate($r);
        $ok = $this->projects->update((string) $r->param('id'), $name, $designJson, $this->context->userId());
        if (!$ok) {
            throw HttpException::notFound('Project not found.');
        }
        return Response::json(['id' => (string) $r->param('id'), 'name' => $name]);
    }

    public function destroy(Request $r): Response
    {
        if (!$this->projects->delete((string) $r->param('id'))) {
            throw HttpException::notFound('Project not found.');
        }
        return Response::noContent();
    }

    /** @return array{0:string,1:string} [name, designJson] */
    private function validate(Request $r): array
    {
        $name = trim((string) $r->input('name', ''));
        $design = $r->input('design');
        if ($name === '') {
            throw HttpException::unprocessable('Project name is required.', 'name');
        }
        if (!is_array($design)) {
            throw HttpException::unprocessable('design must be a JSON object.', 'design');
        }
        $designJson = json_encode($design, JSON_UNESCAPED_SLASHES);
        if ($designJson === false) {
            throw HttpException::unprocessable('design is not serialisable.', 'design');
        }
        if (strlen($designJson) > self::MAX_DESIGN_BYTES) {
            throw new HttpException(413, 'payload_too_large', 'Design exceeds the 1 MB limit.', 'design');
        }
        return [$name, $designJson];
    }
}
